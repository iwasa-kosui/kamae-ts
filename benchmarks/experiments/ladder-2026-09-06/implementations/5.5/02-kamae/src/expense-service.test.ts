import { describe, expect, test } from "bun:test";
import { createExpenseService, type ExpenseServiceDependencies } from "./index";

type TestGatewayCall = Readonly<{
  expenseId: string;
  amountCents: number;
  email: string;
  idempotencyKey: string;
}>;

const makeDependencies = (
  overrides: Partial<ExpenseServiceDependencies> = {},
): ExpenseServiceDependencies & {
  readonly records: Map<string, unknown>;
  readonly gatewayCalls: TestGatewayCall[];
  readonly logs: unknown[];
  readonly saveCount: () => number;
} => {
  const records = new Map<string, unknown>();
  const gatewayCalls: TestGatewayCall[] = [];
  const logs: unknown[] = [];
  let saves = 0;

  const base = {
    repository: {
      get: async (id: string) => records.get(id),
      save: async (id: string, value: unknown) => {
        saves += 1;
        records.set(id, value);
      },
    },
    payment: {
      charge: async (request: TestGatewayCall) => {
        gatewayCalls.push(request);
        return { kind: "paid", receiptId: `receipt-${request.expenseId}` };
      },
    },
    logger: {
      info: (event: unknown) => {
        logs.push(event);
      },
    },
  } satisfies ExpenseServiceDependencies;

  return {
    ...base,
    ...overrides,
    records,
    gatewayCalls,
    logs,
    saveCount: () => saves,
  };
};

const createCommand = {
  op: "create",
  id: "exp-1",
  ownerId: "emp-1",
  ownerEmail: "employee@example.com",
  description: "Taxi",
  amountCents: 2500,
} as const;

const createSubmittedExpense = async () => {
  const dependencies = makeDependencies();
  const service = createExpenseService(dependencies);
  await service.handle(createCommand);
  await service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
  return { dependencies, service };
};

describe("expense approval service", () => {
  test("rejects invalid create commands without saving or logging", async () => {
    const dependencies = makeDependencies();
    const service = createExpenseService(dependencies);

    const response = await service.handle({
      ...createCommand,
      ownerEmail: "not an email",
      amountCents: 0,
    });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(dependencies.records.size).toBe(0);
    expect(dependencies.logs).toHaveLength(0);
  });

  test("creates drafts and never exposes owner email in response or logs", async () => {
    const dependencies = makeDependencies();
    const service = createExpenseService(dependencies);

    const response = await service.handle(createCommand);

    expect(response).toEqual({
      status: 201,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "Taxi",
        amountCents: 2500,
        state: "draft",
      },
    });
    expect(JSON.stringify(response)).not.toContain("employee@example.com");
    expect(JSON.stringify(dependencies.logs)).not.toContain("employee@example.com");
    expect(dependencies.logs).toEqual([{ expenseId: "exp-1", action: "create" }]);
  });

  test("duplicate create preserves the original expense", async () => {
    const dependencies = makeDependencies();
    const service = createExpenseService(dependencies);
    await service.handle(createCommand);
    const original = dependencies.records.get("exp-1");

    const duplicate = await service.handle({
      ...createCommand,
      ownerEmail: "changed@example.com",
      description: "Changed",
      amountCents: 9999,
    });

    expect(duplicate).toEqual({ status: 409, body: { code: "duplicate_expense" } });
    expect(dependencies.records.get("exp-1")).toEqual(original);
    expect(dependencies.saveCount()).toBe(1);
  });

  test("only the owner can submit a draft", async () => {
    const dependencies = makeDependencies();
    const service = createExpenseService(dependencies);
    await service.handle(createCommand);

    const unauthorized = await service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-2",
    });
    const submitted = await service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });

    expect(unauthorized).toEqual({ status: 403, body: { code: "unauthorized_submit" } });
    expect(submitted.body).toMatchObject({ state: "submitted" });
  });

  test("review requires a different employee and rejection is final", async () => {
    const { service } = await createSubmittedExpense();

    const selfReview = await service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-1",
    });
    const rejected = await service.handle({
      op: "reject",
      id: "exp-1",
      actorId: "emp-2",
      reason: "Out of policy",
    });
    const approveRejected = await service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-3",
    });

    expect(selfReview).toEqual({ status: 403, body: { code: "self_review" } });
    expect(rejected.body).toMatchObject({
      state: "rejected",
      reviewerId: "emp-2",
      reason: "Out of policy",
    });
    expect(approveRejected).toEqual({ status: 409, body: { code: "unavailable_stage" } });
  });

  test("rejection requires a nonblank reason before missing-id lookup", async () => {
    const dependencies = makeDependencies();
    const service = createExpenseService(dependencies);

    const invalid = await service.handle({
      op: "reject",
      id: "missing",
      actorId: "emp-2",
      reason: "   ",
    });
    const missing = await service.handle({
      op: "reject",
      id: "missing",
      actorId: "emp-2",
      reason: "Valid reason",
    });

    expect(invalid).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(missing).toEqual({ status: 404, body: { code: "missing_expense" } });
  });

  test("pays approved expense with recorded data and makes completed pay idempotent", async () => {
    const { dependencies, service } = await createSubmittedExpense();
    await service.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });

    const paid = await service.handle({ op: "pay", id: "exp-1" });
    const repeated = await service.handle({ op: "pay", id: "exp-1" });

    expect(paid.body).toMatchObject({
      state: "paid",
      receiptId: "receipt-exp-1",
      reviewerId: "emp-2",
    });
    expect(repeated).toEqual(paid);
    expect(dependencies.gatewayCalls).toEqual([
      {
        expenseId: "exp-1",
        amountCents: 2500,
        email: "employee@example.com",
        idempotencyKey: "exp-1",
      },
    ]);
    expect(dependencies.saveCount()).toBe(4);
  });

  test("declined payment is retryable and does not save paid state", async () => {
    const dependencies = makeDependencies({
      payment: {
        charge: async () => ({ kind: "declined" }),
      },
    });
    const service = createExpenseService(dependencies);
    await service.handle(createCommand);
    await service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
    await service.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });

    const declined = await service.handle({ op: "pay", id: "exp-1" });
    const approved = await service.handle({ op: "get", id: "exp-1" });

    expect(declined).toEqual({ status: 422, body: { code: "payment_declined" } });
    expect(approved.body).toMatchObject({ state: "approved" });
    expect(dependencies.saveCount()).toBe(3);
  });

  test("storage and unusable gateway responses map to service unavailable", async () => {
    const brokenStorage = createExpenseService(
      makeDependencies({
        repository: {
          get: async () => {
            throw new Error("storage down");
          },
          save: async () => undefined,
        },
      }),
    );
    const invalidGatewayDependencies = makeDependencies({
      payment: {
        charge: async () => ({ kind: "paid", receiptId: "" }),
      },
    });
    const invalidGateway = createExpenseService(invalidGatewayDependencies);
    await invalidGateway.handle(createCommand);
    await invalidGateway.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
    await invalidGateway.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });

    expect(await brokenStorage.handle({ op: "get", id: "exp-1" })).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
    expect(await invalidGateway.handle({ op: "pay", id: "exp-1" })).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
  });

  test("invalid stored JSON maps to service unavailable", async () => {
    const dependencies = makeDependencies();
    dependencies.records.set("exp-1", {
      schemaVersion: 1,
      kind: "PaidExpense",
      id: "exp-1",
      ownerId: "emp-1",
      ownerEmail: "employee@example.com",
      description: "Taxi",
      amountCents: 2500,
      reviewerId: "emp-2",
      receiptId: "",
    });
    const service = createExpenseService(dependencies);

    expect(await service.handle({ op: "get", id: "exp-1" })).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
  });
});
