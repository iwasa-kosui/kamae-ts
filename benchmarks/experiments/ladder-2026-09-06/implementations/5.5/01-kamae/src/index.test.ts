import { describe, expect, test } from "bun:test";
import { createExpenseService } from "./index";
import type { ExpenseServiceDependencies } from "./api/dependencies";

type PaymentCall = Readonly<{
  expenseId: string;
  amountCents: number;
  email: string;
  idempotencyKey: string;
}>;

const createHarness = (options?: {
  readonly paymentResponse?: unknown;
  readonly getRejects?: boolean;
  readonly saveRejects?: boolean;
  readonly chargeRejects?: boolean;
}) => {
  const records = new Map<string, unknown>();
  const paymentCalls: PaymentCall[] = [];
  const logs: unknown[] = [];
  let saveCount = 0;

  const dependencies: ExpenseServiceDependencies = {
    repository: {
      get: async (id) => {
        if (options?.getRejects === true) {
          throw new Error("storage unavailable");
        }
        return records.get(id);
      },
      save: async (id, value) => {
        if (options?.saveRejects === true) {
          throw new Error("storage unavailable");
        }
        saveCount += 1;
        records.set(id, value);
      },
    },
    payment: {
      charge: async (request) => {
        if (options?.chargeRejects === true) {
          throw new Error("gateway unavailable");
        }
        paymentCalls.push(request);
        return options?.paymentResponse ?? { kind: "paid", receiptId: "rcpt-1" };
      },
    },
    logger: {
      info: (event) => {
        logs.push(event);
      },
    },
  };

  return {
    service: createExpenseService(dependencies),
    records,
    paymentCalls,
    logs,
    getSaveCount: () => saveCount,
  };
};

const createCommand = {
  op: "create",
  id: "exp-1",
  ownerId: "emp-1",
  ownerEmail: "owner@example.com",
  description: "Team dinner",
  amountCents: 12_345,
} as const;

describe("expense approval service", () => {
  test("creates, retrieves, and keeps owner email out of responses and logs", async () => {
    const harness = createHarness();

    const created = await harness.service.handle(createCommand);
    const fetched = await harness.service.handle({ op: "get", id: "exp-1" });

    expect(created).toEqual({
      status: 201,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "Team dinner",
        amountCents: 12_345,
        state: "draft",
      },
    });
    expect(fetched).toEqual({ status: 200, body: created.body });
    expect(JSON.stringify(created)).not.toContain("owner@example.com");
    expect(JSON.stringify(fetched)).not.toContain("owner@example.com");
    expect(JSON.stringify(harness.logs)).not.toContain("owner@example.com");
    expect(harness.logs).toEqual([
      { expenseId: "exp-1", action: "created", actorId: "emp-1" },
    ]);
  });

  test("rejects invalid creates without saving", async () => {
    const harness = createHarness();

    const response = await harness.service.handle({
      ...createCommand,
      id: "",
      ownerEmail: "not-email",
      description: "   ",
      amountCents: 0,
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.getSaveCount()).toBe(0);
  });

  test("duplicate create preserves the original expense", async () => {
    const harness = createHarness();

    await harness.service.handle(createCommand);
    const duplicate = await harness.service.handle({
      ...createCommand,
      description: "Changed",
      amountCents: 1,
    });
    const fetched = await harness.service.handle({ op: "get", id: "exp-1" });

    expect(duplicate).toEqual({
      status: 409,
      body: { code: "duplicate_expense" },
    });
    expect(fetched.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team dinner",
      amountCents: 12_345,
      state: "draft",
    });
  });

  test("submit requires the owner and only works from draft", async () => {
    const harness = createHarness();

    await harness.service.handle(createCommand);
    const unauthorized = await harness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-2",
    });
    const submitted = await harness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });
    const repeated = await harness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });

    expect(unauthorized).toEqual({
      status: 403,
      body: { code: "unauthorized_submit" },
    });
    expect(submitted.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team dinner",
      amountCents: 12_345,
      state: "submitted",
    });
    expect(repeated).toEqual({
      status: 409,
      body: { code: "operation_unavailable" },
    });
  });

  test("approve and reject enforce reviewer rules and final states", async () => {
    const harness = createHarness();

    await harness.service.handle(createCommand);
    await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });

    const selfApprove = await harness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-1",
    });
    const approved = await harness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-2",
    });
    const rejectAfterApprove = await harness.service.handle({
      op: "reject",
      id: "exp-1",
      actorId: "emp-3",
      reason: "Too late",
    });

    expect(selfApprove).toEqual({
      status: 403,
      body: { code: "self_review" },
    });
    expect(approved.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team dinner",
      amountCents: 12_345,
      state: "approved",
      reviewerId: "emp-2",
    });
    expect(rejectAfterApprove).toEqual({
      status: 409,
      body: { code: "operation_unavailable" },
    });
  });

  test("rejection requires a nonblank reason and is final", async () => {
    const harness = createHarness();

    await harness.service.handle({ ...createCommand, id: "exp-2" });
    await harness.service.handle({ op: "submit", id: "exp-2", actorId: "emp-1" });
    const invalidReason = await harness.service.handle({
      op: "reject",
      id: "exp-2",
      actorId: "emp-2",
      reason: " ",
    });
    const rejected = await harness.service.handle({
      op: "reject",
      id: "exp-2",
      actorId: "emp-2",
      reason: "Missing receipt",
    });
    const approveAfterReject = await harness.service.handle({
      op: "approve",
      id: "exp-2",
      actorId: "emp-3",
    });

    expect(invalidReason).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(rejected.body).toEqual({
      id: "exp-2",
      ownerId: "emp-1",
      description: "Team dinner",
      amountCents: 12_345,
      state: "rejected",
      reviewerId: "emp-2",
      reason: "Missing receipt",
    });
    expect(approveAfterReject).toEqual({
      status: 409,
      body: { code: "operation_unavailable" },
    });
  });

  test("pay charges approved expense with exact gateway payload and is idempotent after success", async () => {
    const harness = createHarness({
      paymentResponse: { kind: "paid", receiptId: "rcpt-123" },
    });

    await harness.service.handle(createCommand);
    await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
    await harness.service.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });
    const beforePaySaveCount = harness.getSaveCount();
    const paid = await harness.service.handle({ op: "pay", id: "exp-1" });
    const afterPaySaveCount = harness.getSaveCount();
    const repeated = await harness.service.handle({ op: "pay", id: "exp-1" });

    expect(harness.paymentCalls).toEqual([
      {
        expenseId: "exp-1",
        amountCents: 12_345,
        email: "owner@example.com",
        idempotencyKey: "exp-1",
      },
    ]);
    expect(paid.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team dinner",
      amountCents: 12_345,
      state: "paid",
      reviewerId: "emp-2",
      receiptId: "rcpt-123",
    });
    expect(repeated).toEqual({ status: 200, body: paid.body });
    expect(harness.paymentCalls).toHaveLength(1);
    expect(afterPaySaveCount).toBe(beforePaySaveCount + 1);
    expect(harness.getSaveCount()).toBe(afterPaySaveCount);
    expect(JSON.stringify(paid)).not.toContain("owner@example.com");
  });

  test("declined payment returns 422 and can be retried without saving paid state", async () => {
    const harness = createHarness({ paymentResponse: { kind: "declined" } });

    await harness.service.handle(createCommand);
    await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
    await harness.service.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });
    const beforePaySaveCount = harness.getSaveCount();
    const declined = await harness.service.handle({ op: "pay", id: "exp-1" });
    const fetched = await harness.service.handle({ op: "get", id: "exp-1" });

    expect(declined).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });
    expect(harness.getSaveCount()).toBe(beforePaySaveCount);
    expect(harness.paymentCalls).toHaveLength(1);
    expect(fetched.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team dinner",
      amountCents: 12_345,
      state: "approved",
      reviewerId: "emp-2",
    });
  });

  test("missing IDs require valid command fields before lookup", async () => {
    const harness = createHarness();

    const invalidMissing = await harness.service.handle({
      op: "reject",
      id: "missing",
      actorId: "emp-2",
      reason: " ",
    });
    const validMissing = await harness.service.handle({
      op: "reject",
      id: "missing",
      actorId: "emp-2",
      reason: "No receipt",
    });

    expect(invalidMissing).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(validMissing).toEqual({
      status: 404,
      body: { code: "missing_expense" },
    });
  });

  test("unavailable operations, malformed stored records, and dependency failures map correctly", async () => {
    const draftHarness = createHarness();
    await draftHarness.service.handle(createCommand);
    const payDraft = await draftHarness.service.handle({ op: "pay", id: "exp-1" });

    const malformedHarness = createHarness();
    malformedHarness.records.set("bad", { version: 1, kind: "Draft", id: "bad" });
    const malformed = await malformedHarness.service.handle({ op: "get", id: "bad" });

    const storageFailure = await createHarness({
      getRejects: true,
    }).service.handle({ op: "get", id: "exp-1" });

    const gatewayFailureHarness = createHarness({ chargeRejects: true });
    await gatewayFailureHarness.service.handle(createCommand);
    await gatewayFailureHarness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });
    await gatewayFailureHarness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-2",
    });
    const gatewayFailure = await gatewayFailureHarness.service.handle({
      op: "pay",
      id: "exp-1",
    });

    const unusableGatewayHarness = createHarness({
      paymentResponse: { kind: "paid", receiptId: " " },
    });
    await unusableGatewayHarness.service.handle(createCommand);
    await unusableGatewayHarness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });
    await unusableGatewayHarness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-2",
    });
    const unusableGateway = await unusableGatewayHarness.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(payDraft).toEqual({
      status: 409,
      body: { code: "operation_unavailable" },
    });
    expect(malformed).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
    expect(storageFailure).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
    expect(gatewayFailure).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
    expect(unusableGateway).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
  });
});
