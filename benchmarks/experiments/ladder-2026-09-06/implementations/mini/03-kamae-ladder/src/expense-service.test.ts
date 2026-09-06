import { describe, expect, it } from "bun:test";
import { createExpenseService, type Dependencies } from "./index";

type ChargeResult = { kind: "paid"; receiptId: string } | { kind: "declined" };

function createHarness(options?: {
  initialStore?: Record<string, unknown>;
  charge?: (request: {
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }) => Promise<ChargeResult>;
  get?: (id: string) => Promise<unknown>;
  save?: (id: string, value: unknown) => Promise<void>;
}) {
  const store = new Map<string, unknown>(Object.entries(options?.initialStore ?? {}));
  const gets: string[] = [];
  const saves: Array<{ id: string; value: unknown }> = [];
  const charges: Array<{ expenseId: string; amountCents: number; email: string; idempotencyKey: string }> = [];
  const events: unknown[] = [];

  const repository: Dependencies["repository"] = {
    async get(id) {
      gets.push(id);
      if (options?.get) {
        return options.get(id);
      }
      return store.get(id);
    },
    async save(id, value) {
      saves.push({ id, value });
      if (options?.save) {
        await options.save(id, value);
        return;
      }
      store.set(id, value);
    },
  };

  const payment: Dependencies["payment"] = {
    async charge(request) {
      charges.push(request);
      if (options?.charge) {
        return options.charge(request);
      }
      return { kind: "paid", receiptId: "receipt-1" };
    },
  };

  const logger: Dependencies["logger"] = {
    info(event) {
      events.push(event);
    },
  };

  return {
    store,
    gets,
    saves,
    charges,
    events,
    service: createExpenseService({ repository, payment, logger }),
  };
}

async function createApprovedExpense() {
  const harness = createHarness();
  const createResponse = await harness.service.handle({
    op: "create",
    id: "expense-1",
    ownerId: "employee-1",
    ownerEmail: "owner@example.com",
    description: "Conference travel",
    amountCents: 12500,
  });
  expect(createResponse.status).toBe(201);

  const submitResponse = await harness.service.handle({
    op: "submit",
    id: "expense-1",
    actorId: "employee-1",
  });
  expect(submitResponse.status).toBe(200);

  const approveResponse = await harness.service.handle({
    op: "approve",
    id: "expense-1",
    actorId: "employee-2",
  });
  expect(approveResponse.status).toBe(200);

  return harness;
}

describe("expense service", () => {
  it("creates, submits, approves, pays, and retrieves an expense without exposing email", async () => {
    const harness = await createApprovedExpense();

    const payResponse = await harness.service.handle({
      op: "pay",
      id: "expense-1",
    });
    expect(payResponse).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Conference travel",
        amountCents: 12500,
        state: "paid",
        reviewerId: "employee-2",
        receiptId: "receipt-1",
      },
    });

    const getResponse = await harness.service.handle({
      op: "get",
      id: "expense-1",
    });

    expect(getResponse).toEqual(payResponse);
    expect(harness.charges).toHaveLength(1);
    expect(harness.saves).toHaveLength(4);
    expect(JSON.stringify(payResponse.body)).not.toContain("owner@example.com");
    expect(JSON.stringify(harness.events)).not.toContain("owner@example.com");
  });

  it("rejects malformed commands before any repository access", async () => {
    const harness = createHarness();

    const response = await harness.service.handle({
      op: "submit",
      id: "expense-1",
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.gets).toEqual([]);
    expect(harness.saves).toEqual([]);
  });

  it("conflicts on duplicate create and preserves the original expense", async () => {
    const harness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "draft",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Existing expense",
          amountCents: 1000,
        },
      },
    });

    const response = await harness.service.handle({
      op: "create",
      id: "expense-1",
      ownerId: "employee-9",
      ownerEmail: "other@example.com",
      description: "Duplicate",
      amountCents: 2000,
    });

    expect(response).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
    expect(harness.saves).toEqual([]);
    expect(harness.store.get("expense-1")).toEqual({
      kind: "draft",
      id: "expense-1",
      ownerId: "employee-1",
      ownerEmail: "owner@example.com",
      description: "Existing expense",
      amountCents: 1000,
    });
  });

  it("only allows the owner to submit a draft", async () => {
    const harness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "draft",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Travel",
          amountCents: 1000,
        },
      },
    });

    const response = await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-2",
    });

    expect(response).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
    expect(harness.saves).toEqual([]);
  });

  it("rejects self-review and blank rejection reasons", async () => {
    const harness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "submitted",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Travel",
          amountCents: 1000,
          submittedBy: "employee-1",
        },
      },
    });

    const selfReview = await harness.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-1",
    });
    expect(selfReview).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });

    const blankReason = await harness.service.handle({
      op: "reject",
      id: "expense-1",
      actorId: "employee-2",
      reason: "   ",
    });
    expect(blankReason).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
  });

  it("reports stage conflicts and missing expenses", async () => {
    const harness = createHarness();

    const missing = await harness.service.handle({
      op: "approve",
      id: "missing",
      actorId: "employee-2",
    });
    expect(missing).toEqual({
      status: 404,
      body: { code: "expense_not_found" },
    });

    const conflict = await harness.service.handle({
      op: "pay",
      id: "draft-1",
    });
    expect(conflict).toEqual({
      status: 404,
      body: { code: "expense_not_found" },
    });

    harness.store.set("draft-1", {
      kind: "draft",
      id: "draft-1",
      ownerId: "employee-1",
      ownerEmail: "owner@example.com",
      description: "Travel",
      amountCents: 1000,
    });

    const stageConflict = await harness.service.handle({
      op: "pay",
      id: "draft-1",
    });
    expect(stageConflict).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
  });

  it("returns the same receipt for repeated payment without another gateway call or save", async () => {
    const harness = await createApprovedExpense();

    const firstPay = await harness.service.handle({
      op: "pay",
      id: "expense-1",
    });
    const secondPay = await harness.service.handle({
      op: "pay",
      id: "expense-1",
    });

    expect(firstPay).toEqual(secondPay);
    expect(harness.charges).toHaveLength(1);
    expect(harness.saves).toHaveLength(4);
  });

  it("returns payment declined without persisting the paid state", async () => {
    const harness = await createApprovedExpense();

    const declinedHarness = createHarness({
      initialStore: Object.fromEntries(harness.store.entries()),
      charge: async () => ({ kind: "declined" }),
    });

    const response = await declinedHarness.service.handle({
      op: "pay",
      id: "expense-1",
    });

    expect(response).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });
    expect(declinedHarness.saves).toHaveLength(0);
  });

  it("returns 500 for gateway or storage failures and for unusable gateway responses", async () => {
    const gatewayFailureHarness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "approved",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Travel",
          amountCents: 1000,
          submittedBy: "employee-1",
          reviewerId: "employee-2",
        },
      },
      charge: async () => {
        throw new Error("gateway unavailable");
      },
    });

    const gatewayFailure = await gatewayFailureHarness.service.handle({
      op: "pay",
      id: "expense-1",
    });
    expect(gatewayFailure).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });

    const unusableGatewayHarness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "approved",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Travel",
          amountCents: 1000,
          submittedBy: "employee-1",
          reviewerId: "employee-2",
        },
      },
      charge: async () => ({ kind: "paid", receiptId: "" }),
    });

    const unusableGateway = await unusableGatewayHarness.service.handle({
      op: "pay",
      id: "expense-1",
    });
    expect(unusableGateway).toEqual({
      status: 500,
      body: { code: "invalid_gateway_response" },
    });

    const storageFailureHarness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "approved",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Travel",
          amountCents: 1000,
          submittedBy: "employee-1",
          reviewerId: "employee-2",
        },
      },
      save: async () => {
        throw new Error("storage unavailable");
      },
    });

    const storageFailure = await storageFailureHarness.service.handle({
      op: "pay",
      id: "expense-1",
    });
    expect(storageFailure).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
  });

  it("validates email and amount fields on create", async () => {
    const harness = createHarness();

    const invalidCreate = await harness.service.handle({
      op: "create",
      id: "expense-1",
      ownerId: "employee-1",
      ownerEmail: "not-an-email",
      description: "Travel",
      amountCents: 0,
    });

    expect(invalidCreate).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.saves).toEqual([]);
  });

  it("rejects unusable stored expense data as a service failure", async () => {
    const harness = createHarness({
      initialStore: {
        "expense-1": {
          kind: "paid",
          id: "expense-1",
          ownerId: "employee-1",
          ownerEmail: "owner@example.com",
          description: "Travel",
          amountCents: 1000,
          submittedBy: "employee-1",
          reviewerId: "employee-2",
          receiptId: "",
        },
      },
    });

    const response = await harness.service.handle({
      op: "get",
      id: "expense-1",
    });

    expect(response).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
  });
});
