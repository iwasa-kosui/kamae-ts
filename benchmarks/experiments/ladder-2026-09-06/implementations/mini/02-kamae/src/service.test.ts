import { describe, expect, test } from "bun:test";
import { createExpenseService } from "./index";

type RepoState = {
  store: Map<string, unknown>;
  saves: Array<{ id: string; value: unknown }>;
};

type PaymentChargeResult =
  | Readonly<{ kind: "paid"; receiptId: string }>
  | Readonly<{ kind: "declined" }>;

const makeRepository = (initial: Record<string, unknown> = {}) => {
  const state: RepoState = {
    store: new Map(Object.entries(initial)),
    saves: [],
  };

  return {
    state,
    repository: {
      get: async (id: string) => state.store.get(id),
      save: async (id: string, value: unknown) => {
        state.saves.push({ id, value });
        state.store.set(id, value);
      },
    },
  } as const;
};

const makePayment = () => {
  const calls: Array<{
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }> = [];

  let response = async (_request: (typeof calls)[number]): Promise<PaymentChargeResult> => ({
    kind: "paid",
    receiptId: "rcpt-123",
  });

  return {
    calls,
    payment: {
      charge: async (request: (typeof calls)[number]) => {
        calls.push(request);
        return response(request);
      },
    },
    setResponse: (nextResponse: typeof response) => {
      response = nextResponse;
    },
  } as const;
};

const makeLogger = () => {
  const events: Array<{ kind: string; expenseId: string; action: string }> = [];
  return {
    events,
    logger: {
      info: (event: { kind: string; expenseId: string; action: string }) => {
        events.push(event);
      },
    },
  } as const;
};

const createService = (initial: Record<string, unknown> = {}) => {
  const repository = makeRepository(initial);
  const payment = makePayment();
  const logger = makeLogger();
  const service = createExpenseService({
    repository: repository.repository,
    payment: payment.payment,
    logger: logger.logger,
  });

  return { service, repository, payment, logger } as const;
};

describe("expense service", () => {
  test("validates command fields before any workflow work", async () => {
    const { service, repository, payment, logger } = createService();

    const response = await service.handle({ op: "create", id: "e-1" });

    expect(response).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(repository.state.saves).toHaveLength(0);
    expect(payment.calls).toHaveLength(0);
    expect(logger.events).toHaveLength(0);
  });

  test("creates, submits, approves, pays, and redacts owner email", async () => {
    const { service, repository, payment, logger } = createService();

    const created = await service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "team lunch",
      amountCents: 4200,
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: "exp-1",
      ownerId: "emp-1",
      description: "team lunch",
      amountCents: 4200,
      state: "draft",
    });
    expect(created.body).not.toHaveProperty("ownerEmail");

    const submitted = await service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
    expect(submitted).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "team lunch",
        amountCents: 4200,
        state: "submitted",
      },
    });

    const approved = await service.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });
    expect(approved).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "team lunch",
        amountCents: 4200,
        state: "approved",
        reviewerId: "emp-2",
      },
    });

    const paid = await service.handle({ op: "pay", id: "exp-1" });
    expect(paid).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "team lunch",
        amountCents: 4200,
        state: "paid",
        reviewerId: "emp-2",
        receiptId: "rcpt-123",
      },
    });

    expect(payment.calls).toEqual([
      {
        expenseId: "exp-1",
        amountCents: 4200,
        email: "owner@example.com",
        idempotencyKey: "exp-1",
      },
    ]);
    expect(repository.state.saves).toHaveLength(4);
    expect(logger.events.map((event) => event.action)).toEqual([
      "created",
      "submitted",
      "approved",
      "paid",
    ]);
    expect(logger.events.every((event) => event.expenseId === "exp-1")).toBeTrue();
  });

  test("returns conflict for duplicate create without overwriting the original", async () => {
    const initial = {
      "exp-1": {
        schemaVersion: 1,
        kind: "draft",
        id: "exp-1",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "existing",
        amountCents: 100,
      },
    };
    const { service, repository, payment, logger } = createService(initial);

    const response = await service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-2",
      ownerEmail: "other@example.com",
      description: "new",
      amountCents: 200,
    });

    expect(response).toEqual({ status: 409, body: { code: "conflict" } });
    expect(repository.state.store.get("exp-1")).toEqual(initial["exp-1"]);
    expect(repository.state.saves).toHaveLength(0);
    expect(payment.calls).toHaveLength(0);
    expect(logger.events).toHaveLength(0);
  });

  test("blocks submit by non-owner and self-review", async () => {
    const initial = {
      "exp-1": {
        schemaVersion: 1,
        kind: "draft",
        id: "exp-1",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "hotel",
        amountCents: 1000,
      },
      "exp-2": {
        schemaVersion: 1,
        kind: "submitted",
        id: "exp-2",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "taxi",
        amountCents: 1000,
      },
    };
    const { service } = createService(initial);

    await expect(service.handle({ op: "submit", id: "exp-1", actorId: "emp-2" })).resolves.toEqual({
      status: 403,
      body: { code: "forbidden" },
    });

    await expect(service.handle({ op: "approve", id: "exp-2", actorId: "emp-1" })).resolves.toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
  });

  test("rejects invalid review reasons and invalid payment gateway responses", async () => {
    const repository = makeRepository({
      "exp-1": {
        schemaVersion: 1,
        kind: "submitted",
        id: "exp-1",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "coffee",
        amountCents: 700,
      },
      "exp-2": {
        schemaVersion: 1,
        kind: "approved",
        id: "exp-2",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "snacks",
        amountCents: 800,
        reviewerId: "emp-2",
      },
    });
    const logger = makeLogger();
    const service = createExpenseService({
      repository: repository.repository,
      payment: {
        charge: async () => ({ kind: "paid", receiptId: "" }),
      },
      logger: logger.logger,
    });

    await expect(service.handle({ op: "reject", id: "exp-1", actorId: "emp-2", reason: "   " })).resolves.toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });

    await expect(service.handle({ op: "pay", id: "exp-2" })).resolves.toEqual({
      status: 500,
      body: { code: "unavailable" },
    });
  });

  test("returns declined payment without saving and retries on later success", async () => {
    const { service, repository, payment, logger } = createService({
      "exp-1": {
        schemaVersion: 1,
        kind: "approved",
        id: "exp-1",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "flight",
        amountCents: 10000,
        reviewerId: "emp-2",
      },
    });

    payment.setResponse(async () => ({ kind: "declined" } as const));
    const declined = await service.handle({ op: "pay", id: "exp-1" });
    expect(declined).toEqual({ status: 422, body: { code: "payment_declined" } });
    expect(repository.state.saves).toHaveLength(0);
    expect(logger.events).toHaveLength(0);

    payment.setResponse(async () => ({ kind: "paid", receiptId: "receipt-99" } as const));
    const succeeded = await service.handle({ op: "pay", id: "exp-1" });
    expect(succeeded).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "flight",
        amountCents: 10000,
        state: "paid",
        reviewerId: "emp-2",
        receiptId: "receipt-99",
      },
    });
    expect(payment.calls).toHaveLength(2);
  });

  test("returns the stored receipt for already paid expenses without another gateway call", async () => {
    const { service, repository, payment, logger } = createService({
      "exp-1": {
        schemaVersion: 1,
        kind: "paid",
        id: "exp-1",
        ownerId: "emp-1",
        ownerEmail: "owner@example.com",
        description: "conference",
        amountCents: 30000,
        reviewerId: "emp-2",
        receiptId: "receipt-final",
      },
    });

    const response = await service.handle({ op: "pay", id: "exp-1" });
    expect(response).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "conference",
        amountCents: 30000,
        state: "paid",
        reviewerId: "emp-2",
        receiptId: "receipt-final",
      },
    });
    expect(payment.calls).toHaveLength(0);
    expect(repository.state.saves).toHaveLength(0);
    expect(logger.events).toHaveLength(0);
  });

  test("returns unavailable for malformed stored records", async () => {
    const { service } = createService({
      "exp-1": {
        schemaVersion: 99,
        kind: "draft",
        id: "exp-1",
      },
    });

    await expect(service.handle({ op: "get", id: "exp-1" })).resolves.toEqual({
      status: 500,
      body: { code: "unavailable" },
    });
  });
});
