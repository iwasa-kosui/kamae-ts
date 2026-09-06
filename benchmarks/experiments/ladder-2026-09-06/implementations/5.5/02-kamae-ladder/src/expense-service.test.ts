import { describe, expect, test } from "bun:test";
import { createExpenseService, type ExpenseServiceDependencies } from "./index";
import type { JsonValue, PaymentGateway, PaymentResult, Repository } from "./api/dependencies";

const createCommand = {
  op: "create",
  id: "expense-1",
  ownerId: "employee-1",
  ownerEmail: "owner@example.com",
  description: "Client dinner",
  amountCents: 12_345,
} as const;

const makeDependencies = () => {
  const records = new Map<string, JsonValue>();
  const logs: ReadonlyArray<{ expenseId: string; action: string }>[] = [];
  const paymentCalls: Parameters<PaymentGateway["charge"]>[0][] = [];
  const saves: string[] = [];
  let nextPaymentResult: PaymentResult = { kind: "paid", receiptId: "receipt-1" };
  let failGet = false;
  let failSave = false;
  let failPayment = false;

  const repository: Repository = {
    get: async (id) => {
      if (failGet) throw new Error("repository get failed");
      return records.get(id);
    },
    save: async (id, value) => {
      if (failSave) throw new Error("repository save failed");
      saves.push(id);
      records.set(id, value);
    },
  };

  const payment: PaymentGateway = {
    charge: async (request) => {
      if (failPayment) throw new Error("payment failed");
      paymentCalls.push(request);
      return nextPaymentResult;
    },
  };

  const logger = {
    info: (event: { expenseId: string; action: string }) => {
      logs.push([event]);
    },
  };

  const dependencies: ExpenseServiceDependencies = { repository, payment, logger };

  return {
    dependencies,
    records,
    logs,
    paymentCalls,
    saves,
    declineNextPayment: () => {
      nextPaymentResult = { kind: "declined" };
    },
    payWithEmptyReceipt: () => {
      nextPaymentResult = { kind: "paid", receiptId: "" };
    },
    failNextGet: () => {
      failGet = true;
    },
    failNextSave: () => {
      failSave = true;
    },
    failNextPayment: () => {
      failPayment = true;
    },
  };
};

const createSubmitApprove = async (dependencies: ExpenseServiceDependencies) => {
  const service = createExpenseService(dependencies);
  await service.handle(createCommand);
  await service.handle({ op: "submit", id: "expense-1", actorId: "employee-1" });
  await service.handle({ op: "approve", id: "expense-1", actorId: "employee-2" });
  return service;
};

describe("expense approval service", () => {
  test("creates a draft expense and keeps owner email private", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    const response = await service.handle(createCommand);

    expect(response).toEqual({
      status: 201,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 12_345,
        state: "draft",
      },
    });
    expect(JSON.stringify(response)).not.toContain("owner@example.com");
    expect(JSON.stringify(fixture.logs)).not.toContain("owner@example.com");
    expect(fixture.logs).toEqual([[{ expenseId: "expense-1", action: "created" }]]);
  });

  test("rejects invalid create fields without saving", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    const response = await service.handle({
      op: "create",
      id: "",
      ownerId: "employee-1",
      ownerEmail: "not-an-email",
      description: "   ",
      amountCents: 0,
    });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(fixture.saves).toEqual([]);
    expect(fixture.paymentCalls).toEqual([]);
  });

  test("requires command fields before reporting a missing expense", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    const response = await service.handle({ op: "reject", id: "missing", actorId: "employee-2" });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
  });

  test("duplicate create preserves the original expense", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    await service.handle(createCommand);
    const duplicate = await service.handle({
      ...createCommand,
      ownerEmail: "other@example.com",
      description: "Changed",
      amountCents: 99,
    });
    const current = await service.handle({ op: "get", id: "expense-1" });

    expect(duplicate).toEqual({ status: 409, body: { code: "duplicate_id" } });
    expect(current).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 12_345,
        state: "draft",
      },
    });
  });

  test("runs the create to submit to approve to pay workflow", async () => {
    const fixture = makeDependencies();
    const service = await createSubmitApprove(fixture.dependencies);

    const response = await service.handle({ op: "pay", id: "expense-1" });

    expect(response).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 12_345,
        state: "paid",
        reviewerId: "employee-2",
        receiptId: "receipt-1",
      },
    });
    expect(fixture.paymentCalls).toEqual([
      {
        expenseId: "expense-1",
        amountCents: 12_345,
        email: "owner@example.com",
        idempotencyKey: "expense-1",
      },
    ]);
    expect(JSON.stringify(response)).not.toContain("owner@example.com");
  });

  test("blocks unauthorized submit and self-review", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    await service.handle(createCommand);
    const submit = await service.handle({ op: "submit", id: "expense-1", actorId: "employee-2" });
    await service.handle({ op: "submit", id: "expense-1", actorId: "employee-1" });
    const approve = await service.handle({ op: "approve", id: "expense-1", actorId: "employee-1" });

    expect(submit).toEqual({ status: 403, body: { code: "unauthorized_submit" } });
    expect(approve).toEqual({ status: 403, body: { code: "self_review" } });
  });

  test("enforces unavailable workflow transitions", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    await service.handle(createCommand);
    const payDraft = await service.handle({ op: "pay", id: "expense-1" });
    await service.handle({ op: "submit", id: "expense-1", actorId: "employee-1" });
    await service.handle({ op: "approve", id: "expense-1", actorId: "employee-2" });
    await service.handle({ op: "pay", id: "expense-1" });
    const reviewPaid = await service.handle({ op: "reject", id: "expense-1", actorId: "employee-3", reason: "Too late" });

    expect(payDraft).toEqual({ status: 409, body: { code: "invalid_state" } });
    expect(reviewPaid).toEqual({ status: 409, body: { code: "invalid_state" } });
  });

  test("reject requires a nonblank reason and is final", async () => {
    const fixture = makeDependencies();
    const service = createExpenseService(fixture.dependencies);

    await service.handle(createCommand);
    await service.handle({ op: "submit", id: "expense-1", actorId: "employee-1" });
    const invalidReject = await service.handle({ op: "reject", id: "expense-1", actorId: "employee-2", reason: " " });
    const rejected = await service.handle({ op: "reject", id: "expense-1", actorId: "employee-2", reason: "Missing receipt" });
    const approveRejected = await service.handle({ op: "approve", id: "expense-1", actorId: "employee-3" });

    expect(invalidReject).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(rejected).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 12_345,
        state: "rejected",
        reviewerId: "employee-2",
        reason: "Missing receipt",
      },
    });
    expect(approveRejected).toEqual({ status: 409, body: { code: "invalid_state" } });
  });

  test("payment decline is retryable and does not save paid state", async () => {
    const fixture = makeDependencies();
    fixture.declineNextPayment();
    const service = await createSubmitApprove(fixture.dependencies);
    const savesBeforeDecline = fixture.saves.length;

    const declined = await service.handle({ op: "pay", id: "expense-1" });
    const current = await service.handle({ op: "get", id: "expense-1" });

    expect(declined).toEqual({ status: 422, body: { code: "payment_declined" } });
    expect(current).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 12_345,
        state: "approved",
        reviewerId: "employee-2",
      },
    });
    expect(fixture.saves.length).toBe(savesBeforeDecline);
  });

  test("completed payment is idempotent without extra gateway call or save", async () => {
    const fixture = makeDependencies();
    const service = await createSubmitApprove(fixture.dependencies);

    await service.handle({ op: "pay", id: "expense-1" });
    const savesAfterPayment = fixture.saves.length;
    const second = await service.handle({ op: "pay", id: "expense-1" });

    expect(second).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 12_345,
        state: "paid",
        reviewerId: "employee-2",
        receiptId: "receipt-1",
      },
    });
    expect(fixture.paymentCalls.length).toBe(1);
    expect(fixture.saves.length).toBe(savesAfterPayment);
  });

  test("missing, storage failures, invalid storage, and gateway failures map to required errors", async () => {
    const missingFixture = makeDependencies();
    const missing = await createExpenseService(missingFixture.dependencies).handle({ op: "get", id: "missing" });
    expect(missing).toEqual({ status: 404, body: { code: "missing_expense" } });

    const getFailureFixture = makeDependencies();
    getFailureFixture.failNextGet();
    const getFailure = await createExpenseService(getFailureFixture.dependencies).handle({ op: "get", id: "expense-1" });
    expect(getFailure).toEqual({ status: 500, body: { code: "service_unavailable" } });

    const invalidStorageFixture = makeDependencies();
    invalidStorageFixture.records.set("expense-1", { schemaVersion: 1, kind: "draft", id: "expense-1" });
    const invalidStorage = await createExpenseService(invalidStorageFixture.dependencies).handle({ op: "get", id: "expense-1" });
    expect(invalidStorage).toEqual({ status: 500, body: { code: "storage_unavailable" } });

    const gatewayFailureFixture = makeDependencies();
    gatewayFailureFixture.failNextPayment();
    const gatewayFailureService = await createSubmitApprove(gatewayFailureFixture.dependencies);
    const gatewayFailure = await gatewayFailureService.handle({ op: "pay", id: "expense-1" });
    expect(gatewayFailure).toEqual({ status: 500, body: { code: "service_unavailable" } });

    const emptyReceiptFixture = makeDependencies();
    emptyReceiptFixture.payWithEmptyReceipt();
    const emptyReceiptService = await createSubmitApprove(emptyReceiptFixture.dependencies);
    const emptyReceipt = await emptyReceiptService.handle({ op: "pay", id: "expense-1" });
    expect(emptyReceipt).toEqual({ status: 500, body: { code: "payment_unavailable" } });
  });

  test("save failures produce unsuccessful responses", async () => {
    const fixture = makeDependencies();
    fixture.failNextSave();
    const service = createExpenseService(fixture.dependencies);

    const response = await service.handle(createCommand);

    expect(response).toEqual({ status: 500, body: { code: "service_unavailable" } });
  });
});
