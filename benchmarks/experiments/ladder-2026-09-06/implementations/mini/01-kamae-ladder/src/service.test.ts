import { describe, expect, mock, test } from "bun:test";
import { createExpenseService } from "./index";

type MemoryRepository = {
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: unknown) => Promise<void>;
  snapshot: () => ReadonlyMap<string, unknown>;
};

const createMemoryRepository = (seed: ReadonlyArray<[string, unknown]> = []): MemoryRepository => {
  const store = new Map<string, unknown>(seed);
  return {
    get: async (id) => store.get(id),
    save: async (id, value) => {
      store.set(id, value);
    },
    snapshot: () => new Map(store),
  };
};

const makeService = (overrides: Partial<{
  repository: MemoryRepository;
  payment: {
    charge: (input: {
      expenseId: string;
      amountCents: number;
      email: string;
      idempotencyKey: string;
    }) => Promise<{ kind: "paid"; receiptId: string } | { kind: "declined" }>;
  };
  logger: { info: (event: unknown) => void };
}> = {}) => {
  const repository = overrides.repository ?? createMemoryRepository();
  const loggerEvents: unknown[] = [];
  const payment =
    overrides.payment ??
    ({
      charge: mock(async () => ({ kind: "paid" as const, receiptId: "rcpt-1" })),
    } as const);
  const logger =
    overrides.logger ??
    {
      info: mock((event: unknown) => {
        loggerEvents.push(event);
      }),
    };

  return {
    service: createExpenseService({ repository, payment, logger }),
    repository,
    payment,
    logger,
    loggerEvents,
  };
};

describe("expense service", () => {
  test("creates, submits, approves, pays, and retrieves without exposing ownerEmail", async () => {
    const { service, repository, payment, logger, loggerEvents } = makeService();

    const create = await service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "Team lunch",
      amountCents: 5432,
    });
    expect(create.status).toBe(201);
    expect(create.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team lunch",
      amountCents: 5432,
      state: "draft",
    });
    expect(JSON.stringify(create.body)).not.toContain("owner@example.com");
    expect(logger.info).toHaveBeenCalledWith({
      kind: "expense.created",
      expenseId: "exp-1",
    });

    const submit = await service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });
    expect(submit.status).toBe(200);
    expect(submit.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team lunch",
      amountCents: 5432,
      state: "submitted",
    });
    expect(logger.info).toHaveBeenCalledWith({
      kind: "expense.submitted",
      expenseId: "exp-1",
    });

    const approve = await service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-2",
    });
    expect(approve.status).toBe(200);
    expect(approve.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team lunch",
      amountCents: 5432,
      state: "approved",
      reviewerId: "emp-2",
    });
    expect(logger.info).toHaveBeenCalledWith({
      kind: "expense.approved",
      expenseId: "exp-1",
    });

    const pay = await service.handle({ op: "pay", id: "exp-1" });
    expect(pay.status).toBe(200);
    expect(pay.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Team lunch",
      amountCents: 5432,
      state: "paid",
      reviewerId: "emp-2",
      receiptId: "rcpt-1",
    });
    expect(payment.charge).toHaveBeenCalledTimes(1);
    expect(payment.charge).toHaveBeenCalledWith({
      expenseId: "exp-1",
      amountCents: 5432,
      email: "owner@example.com",
      idempotencyKey: "exp-1",
    });
    expect(logger.info).toHaveBeenCalledWith({
      kind: "expense.paid",
      expenseId: "exp-1",
    });

    const repeatPay = await service.handle({ op: "pay", id: "exp-1" });
    expect(repeatPay.status).toBe(200);
    expect(repeatPay.body).toEqual(pay.body);
    expect(payment.charge).toHaveBeenCalledTimes(1);

    const get = await service.handle({ op: "get", id: "exp-1" });
    expect(get.status).toBe(200);
    expect(get.body).toEqual(pay.body);

    expect([...repository.snapshot().values()]).toHaveLength(1);
    expect(JSON.stringify(loggerEvents)).not.toContain("owner@example.com");
  });

  test("rejects invalid commands and invalid fields before side effects", async () => {
    const repository = createMemoryRepository();
    const payment = {
      charge: mock(async () => ({ kind: "paid" as const, receiptId: "rcpt-1" })),
    };
    const logger = { info: mock(() => undefined) };
    const service = createExpenseService({ repository, payment, logger });

    const invalid = await service.handle({
      op: "create",
      id: "",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "Lunch",
      amountCents: 100,
    });

    expect(invalid).toEqual({ status: 400, body: { code: "invalid_command" } });
    expect(payment.charge).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(repository.snapshot().size).toBe(0);
  });

  test("keeps the original record on duplicate create", async () => {
    const repository = createMemoryRepository();
    const service = createExpenseService({
      repository,
      payment: { charge: mock(async () => ({ kind: "paid" as const, receiptId: "rcpt-1" })) },
      logger: { info: mock(() => undefined) },
    });

    await service.handle({
      op: "create",
      id: "exp-dup",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "Taxi",
      amountCents: 2500,
    });

    const duplicate = await service.handle({
      op: "create",
      id: "exp-dup",
      ownerId: "emp-2",
      ownerEmail: "other@example.com",
      description: "Changed",
      amountCents: 1,
    });

    expect(duplicate.status).toBe(409);
    expect(repository.snapshot().get("exp-dup")).toMatchObject({
      kind: "draft",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "Taxi",
      amountCents: 2500,
    });
  });

  test("enforces owner-only submit and reviewer separation", async () => {
    const repository = createMemoryRepository();
    const service = createExpenseService({
      repository,
      payment: { charge: mock(async () => ({ kind: "paid" as const, receiptId: "rcpt-1" })) },
      logger: { info: mock(() => undefined) },
    });

    await service.handle({
      op: "create",
      id: "exp-2",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "Hotel",
      amountCents: 9000,
    });

    expect(
      await service.handle({
        op: "submit",
        id: "exp-2",
        actorId: "emp-2",
      }),
    ).toEqual({ status: 403, body: { code: "forbidden" } });

    await service.handle({
      op: "submit",
      id: "exp-2",
      actorId: "emp-1",
    });

    expect(
      await service.handle({
        op: "approve",
        id: "exp-2",
        actorId: "emp-1",
      }),
    ).toEqual({ status: 403, body: { code: "forbidden" } });

    expect(
      await service.handle({
        op: "approve",
        id: "exp-2",
        actorId: "emp-3",
      }),
    ).toMatchObject({ status: 200 });
  });

  test("rejects in the current stage and handles payment decline and reuse", async () => {
    let attempts = 0;
    const repository = createMemoryRepository();
    const payment = {
      charge: mock(async () => {
        attempts += 1;
        return attempts === 1
          ? ({ kind: "declined" } as const)
          : ({ kind: "paid" as const, receiptId: "rcpt-2" });
      }),
    };
    const logger = { info: mock(() => undefined) };
    const service = createExpenseService({ repository, payment, logger });

    await service.handle({
      op: "create",
      id: "exp-3",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "Conference",
      amountCents: 12345,
    });

    expect(
      await service.handle({
        op: "pay",
        id: "exp-3",
      }),
    ).toEqual({ status: 409, body: { code: "conflict" } });

    await service.handle({
      op: "submit",
      id: "exp-3",
      actorId: "emp-1",
    });
    await service.handle({
      op: "approve",
      id: "exp-3",
      actorId: "emp-2",
    });

    const declined = await service.handle({
      op: "pay",
      id: "exp-3",
    });
    expect(declined).toEqual({ status: 422, body: { code: "payment_declined" } });
    expect(repository.snapshot().get("exp-3")).toMatchObject({ kind: "approved" });

    const paid = await service.handle({
      op: "pay",
      id: "exp-3",
    });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({
      state: "paid",
      receiptId: "rcpt-2",
    });
    expect(payment.charge).toHaveBeenCalledTimes(2);
  });

  test("returns 500 for malformed stored records", async () => {
    const repository = createMemoryRepository([
      [
        "exp-bad",
        {
          kind: "paid",
          id: "exp-bad",
          ownerId: "emp-1",
          ownerEmail: "owner@example.com",
          description: "broken",
          amountCents: 100,
          reviewerId: "emp-2",
          receiptId: "",
        },
      ],
    ]);
    const service = createExpenseService({
      repository,
      payment: { charge: mock(async () => ({ kind: "paid" as const, receiptId: "rcpt-1" })) },
      logger: { info: mock(() => undefined) },
    });

    expect(await service.handle({ op: "get", id: "exp-bad" })).toEqual({
      status: 500,
      body: { code: "internal_error" },
    });
  });
});
