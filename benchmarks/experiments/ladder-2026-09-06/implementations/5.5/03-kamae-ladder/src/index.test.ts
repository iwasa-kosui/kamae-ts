import { describe, expect, test } from "bun:test";
import { createExpenseService, type ExpenseServiceDependencies } from "./index";
import type { StoredExpense } from "./application/validation";

type ChargeRequest = Readonly<{
  expenseId: string;
  amountCents: number;
  email: string;
  idempotencyKey: string;
}>;

type TestPaymentResult =
  | Readonly<{ kind: "paid"; receiptId: string }>
  | Readonly<{ kind: "declined" }>;

const draftExpense = {
  kind: "draft",
  id: "expense-1",
  ownerId: "employee-1",
  ownerEmail: "owner@example.com",
  description: "Train ticket",
  amountCents: 1234,
} as const satisfies StoredExpense;

const createHarness = (
  initial: readonly StoredExpense[] = [],
  paymentResults: readonly TestPaymentResult[] = [
    { kind: "paid", receiptId: "receipt-1" },
  ],
) => {
  const store = new Map<string, unknown>(
    initial.map((expense) => [expense.id, expense]),
  );
  const saves: Array<Readonly<{ id: string; value: unknown }>> = [];
  const charges: ChargeRequest[] = [];
  const logs: Array<Readonly<{ expenseId: string; action: string }>> = [];
  const queuedPayments = [...paymentResults];

  const dependencies: ExpenseServiceDependencies = {
    repository: {
      get: async (id) => store.get(id),
      save: async (id, value) => {
        saves.push({ id, value });
        store.set(id, value);
      },
    },
    payment: {
      charge: async (request) => {
        charges.push(request);
        const next = queuedPayments.shift();
        return next ?? { kind: "paid", receiptId: `receipt-${charges.length}` };
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
    store,
    saves,
    charges,
    logs,
  };
};

describe("createExpenseService", () => {
  test("creates a draft expense without exposing email and logs non-PII", async () => {
    const { service, store, logs } = createHarness();

    const response = await service.handle({
      op: "create",
      id: "expense-1",
      ownerId: "employee-1",
      ownerEmail: "owner@example.com",
      description: "Train ticket",
      amountCents: 1234,
    });

    expect(response).toEqual({
      status: 201,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "draft",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("owner@example.com");
    expect(store.get("expense-1")).toEqual(draftExpense);
    expect(logs).toEqual([{ expenseId: "expense-1", action: "created" }]);
  });

  test("rejects invalid create commands before saving", async () => {
    const { service, saves } = createHarness();

    const response = await service.handle({
      op: "create",
      id: "",
      ownerId: "employee-1",
      ownerEmail: "not-email",
      description: " ",
      amountCents: 0,
    });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(saves).toHaveLength(0);
  });

  test("duplicate create preserves the original expense", async () => {
    const { service, store, saves } = createHarness([draftExpense]);

    const response = await service.handle({
      op: "create",
      id: "expense-1",
      ownerId: "employee-2",
      ownerEmail: "other@example.com",
      description: "Changed",
      amountCents: 9999,
    });

    expect(response).toEqual({ status: 409, body: { code: "duplicate_id" } });
    expect(store.get("expense-1")).toEqual(draftExpense);
    expect(saves).toHaveLength(0);
  });

  test("validates required fields before missing-ID handling", async () => {
    const { service } = createHarness();

    const response = await service.handle({ op: "submit", id: "missing" });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
  });

  test("allows only the owner to submit a draft", async () => {
    const { service } = createHarness([draftExpense]);

    expect(
      await service.handle({ op: "submit", id: "expense-1", actorId: "employee-2" }),
    ).toEqual({ status: 403, body: { code: "forbidden" } });

    expect(
      await service.handle({ op: "submit", id: "expense-1", actorId: "employee-1" }),
    ).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "submitted",
      },
    });
  });

  test("approves submitted expenses and forbids self-review", async () => {
    const submitted = { ...draftExpense, kind: "submitted" } as const satisfies StoredExpense;
    const { service } = createHarness([submitted]);

    expect(
      await service.handle({ op: "approve", id: "expense-1", actorId: "employee-1" }),
    ).toEqual({ status: 403, body: { code: "forbidden" } });

    expect(
      await service.handle({ op: "approve", id: "expense-1", actorId: "employee-2" }),
    ).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "approved",
        reviewerId: "employee-2",
      },
    });
  });

  test("rejects submitted expenses with a reason and makes rejection final", async () => {
    const submitted = { ...draftExpense, kind: "submitted" } as const satisfies StoredExpense;
    const { service } = createHarness([submitted]);

    expect(
      await service.handle({
        op: "reject",
        id: "expense-1",
        actorId: "employee-2",
        reason: "missing receipt",
      }),
    ).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "rejected",
        reviewerId: "employee-2",
        reason: "missing receipt",
      },
    });

    expect(
      await service.handle({ op: "approve", id: "expense-1", actorId: "employee-3" }),
    ).toEqual({ status: 409, body: { code: "invalid_state" } });
  });

  test("requires a nonblank rejection reason", async () => {
    const submitted = { ...draftExpense, kind: "submitted" } as const satisfies StoredExpense;
    const { service, saves } = createHarness([submitted]);

    const response = await service.handle({
      op: "reject",
      id: "expense-1",
      actorId: "employee-2",
      reason: " ",
    });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(saves).toHaveLength(0);
  });

  test("pays approved expenses with exact gateway fields and keeps the receipt", async () => {
    const approved = {
      ...draftExpense,
      kind: "approved",
      reviewerId: "employee-2",
    } as const satisfies StoredExpense;
    const { service, charges, store } = createHarness([approved], [
      { kind: "paid", receiptId: "receipt-99" },
    ]);

    const response = await service.handle({ op: "pay", id: "expense-1" });

    expect(charges).toEqual([
      {
        expenseId: "expense-1",
        amountCents: 1234,
        email: "owner@example.com",
        idempotencyKey: "expense-1",
      },
    ]);
    expect(response).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "paid",
        reviewerId: "employee-2",
        receiptId: "receipt-99",
      },
    });
    expect(store.get("expense-1")).toEqual({
      ...approved,
      kind: "paid",
      receiptId: "receipt-99",
    });
  });

  test("repeat payment returns existing receipt without gateway call or save", async () => {
    const paid = {
      ...draftExpense,
      kind: "paid",
      reviewerId: "employee-2",
      receiptId: "receipt-99",
    } as const satisfies StoredExpense;
    const { service, charges, saves } = createHarness([paid]);

    const response = await service.handle({ op: "pay", id: "expense-1" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "expense-1",
      ownerId: "employee-1",
      description: "Train ticket",
      amountCents: 1234,
      state: "paid",
      reviewerId: "employee-2",
      receiptId: "receipt-99",
    });
    expect(charges).toHaveLength(0);
    expect(saves).toHaveLength(0);
  });

  test("declined payment can be retried and does not mark paid", async () => {
    const approved = {
      ...draftExpense,
      kind: "approved",
      reviewerId: "employee-2",
    } as const satisfies StoredExpense;
    const { service, charges, store } = createHarness([approved], [
      { kind: "declined" },
      { kind: "paid", receiptId: "receipt-retry" },
    ]);

    expect(await service.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });
    expect(store.get("expense-1")).toEqual(approved);

    expect(await service.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "paid",
        reviewerId: "employee-2",
        receiptId: "receipt-retry",
      },
    });
    expect(charges).toHaveLength(2);
  });

  test("unavailable dependencies and unusable gateway responses return 500", async () => {
    const approved = {
      ...draftExpense,
      kind: "approved",
      reviewerId: "employee-2",
    } as const satisfies StoredExpense;
    const unavailable = createExpenseService({
      repository: {
        get: async () => approved,
        save: async () => {},
      },
      payment: {
        charge: async () => {
          throw new Error("gateway down");
        },
      },
      logger: { info: () => {} },
    });

    expect(await unavailable.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });

    const unusable = createExpenseService({
      repository: {
        get: async () => approved,
        save: async () => {},
      },
      payment: {
        charge: async () => ({ kind: "paid", receiptId: " " }),
      },
      logger: { info: () => {} },
    });

    expect(await unusable.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 500,
      body: { code: "invalid_dependency_response" },
    });
  });

  test("repository failures and invalid stored records return 500", async () => {
    const getFailure = createExpenseService({
      repository: {
        get: async () => {
          throw new Error("storage down");
        },
        save: async () => {},
      },
      payment: { charge: async () => ({ kind: "paid", receiptId: "receipt" }) },
      logger: { info: () => {} },
    });

    expect(await getFailure.handle({ op: "get", id: "expense-1" })).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });

    const invalidStored = createExpenseService({
      repository: {
        get: async () => ({ ...draftExpense, ownerEmail: "not-email" }),
        save: async () => {},
      },
      payment: { charge: async () => ({ kind: "paid", receiptId: "receipt" }) },
      logger: { info: () => {} },
    });

    expect(await invalidStored.handle({ op: "get", id: "expense-1" })).toEqual({
      status: 500,
      body: { code: "invalid_dependency_response" },
    });
  });

  test("get reports missing IDs and never includes owner email", async () => {
    const rejected = {
      ...draftExpense,
      kind: "rejected",
      reviewerId: "employee-2",
      reason: "missing receipt",
    } as const satisfies StoredExpense;
    const { service } = createHarness([rejected]);

    expect(await service.handle({ op: "get", id: "missing" })).toEqual({
      status: 404,
      body: { code: "not_found" },
    });

    const response = await service.handle({ op: "get", id: "expense-1" });
    expect(JSON.stringify(response.body)).not.toContain("owner@example.com");
    expect(response).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Train ticket",
        amountCents: 1234,
        state: "rejected",
        reviewerId: "employee-2",
        reason: "missing receipt",
      },
    });
  });

  test("drafts cannot be paid and paid expenses cannot be reviewed", async () => {
    const paid = {
      ...draftExpense,
      kind: "paid",
      reviewerId: "employee-2",
      receiptId: "receipt-99",
    } as const satisfies StoredExpense;
    const draftHarness = createHarness([draftExpense]);
    const paidHarness = createHarness([paid]);

    expect(await draftHarness.service.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 409,
      body: { code: "invalid_state" },
    });
    expect(
      await paidHarness.service.handle({
        op: "reject",
        id: "expense-1",
        actorId: "employee-3",
        reason: "late",
      }),
    ).toEqual({ status: 409, body: { code: "invalid_state" } });
  });
});
