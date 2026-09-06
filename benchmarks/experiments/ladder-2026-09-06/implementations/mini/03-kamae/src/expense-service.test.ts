import { describe, expect, it } from "bun:test";
import { createExpenseService } from "./index";

const makeRepository = (initial: ReadonlyArray<readonly [string, unknown]> = []) => {
  const store = new Map(initial);
  const calls = {
    get: [] as Array<string>,
    save: [] as Array<readonly [string, unknown]>,
  };

  return {
    repository: {
      get: async (id: string) => {
        calls.get.push(id);
        return store.get(id);
      },
      save: async (id: string, value: unknown) => {
        calls.save.push([id, value] as const);
        store.set(id, value);
      },
    },
    calls,
    store,
  } as const;
};

const makePayment = () => {
  const calls: Array<Readonly<{ expenseId: string; amountCents: number; email: string; idempotencyKey: string }>> = [];
  let next: Readonly<{ kind: "paid"; receiptId: string } | { kind: "declined" }> = {
    kind: "paid",
    receiptId: "rcpt-default",
  };

  return {
    payment: {
      charge: async (request: Readonly<{
        expenseId: string;
        amountCents: number;
        email: string;
        idempotencyKey: string;
      }>) => {
        calls.push(request);
        return next;
      },
    },
    calls,
    setNext: (value: Readonly<{ kind: "paid"; receiptId: string } | { kind: "declined" }>) => {
      next = value;
    },
  } as const;
};

const makeLogger = () => {
  const events: Array<Readonly<{ kind: "expense_event"; expenseId: string; action: string }>> = [];
  return {
    logger: {
      info: (event: Readonly<{ kind: "expense_event"; expenseId: string; action: string }>) => {
        events.push(event);
      },
    },
    events,
  } as const;
};

const makeService = (initial: ReadonlyArray<readonly [string, unknown]> = []) => {
  const repository = makeRepository(initial);
  const payment = makePayment();
  const logger = makeLogger();
  const service = createExpenseService({
    repository: repository.repository,
    payment: payment.payment,
    logger: logger.logger,
  });

  return {
    service,
    repository,
    payment,
    logger,
  } as const;
};

describe("expense service", () => {
  it("creates, submits, approves, pays, and returns the stored receipt on repeat payment", async () => {
    const runtime = makeService();

    const created = await runtime.service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "team lunch",
      amountCents: 4200,
    });

    expect(created).toEqual({
      status: 201,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "team lunch",
        amountCents: 4200,
        state: "draft",
      },
    });

    const submitted = await runtime.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-1",
    });

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

    const approved = await runtime.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-2",
    });

    expect(approved).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "team lunch",
        amountCents: 4200,
        reviewerId: "emp-2",
        state: "approved",
      },
    });

    const paid = await runtime.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(paid).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "team lunch",
        amountCents: 4200,
        reviewerId: "emp-2",
        receiptId: "rcpt-default",
        state: "paid",
      },
    });

    runtime.payment.setNext({
      kind: "paid",
      receiptId: "rcpt-ignored",
    });

    const repeated = await runtime.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(repeated).toEqual(paid);
    expect(runtime.payment.calls).toHaveLength(1);
    expect(runtime.repository.calls.save).toHaveLength(4);
    expect(runtime.logger.events).toEqual([
      { kind: "expense_event", expenseId: "exp-1", action: "created" },
      { kind: "expense_event", expenseId: "exp-1", action: "submitted" },
      { kind: "expense_event", expenseId: "exp-1", action: "approved" },
      { kind: "expense_event", expenseId: "exp-1", action: "paid" },
    ]);
  });

  it("rejects malformed commands before touching storage", async () => {
    const runtime = makeService();

    const response = await runtime.service.handle({
      op: "create",
      id: "",
      ownerId: "emp-1",
      ownerEmail: "bad-email",
      description: "   ",
      amountCents: 0,
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(runtime.repository.calls.get).toEqual([]);
    expect(runtime.repository.calls.save).toEqual([]);
    expect(runtime.payment.calls).toEqual([]);
    expect(runtime.logger.events).toEqual([]);
  });

  it("keeps the original expense when a duplicate id is created", async () => {
    const runtime = makeService([
      [
        "exp-1",
        {
          kind: "draft",
          id: "exp-1",
          ownerId: "emp-1",
          ownerEmail: "owner@example.com",
          description: "original",
          amountCents: 111,
        },
      ],
    ]);

    const response = await runtime.service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-2",
      ownerEmail: "other@example.com",
      description: "different",
      amountCents: 222,
    });

    expect(response).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
    expect(runtime.repository.store.get("exp-1")).toEqual({
      kind: "draft",
      id: "exp-1",
      ownerId: "emp-1",
      ownerEmail: "owner@example.com",
      description: "original",
      amountCents: 111,
    });
    expect(runtime.logger.events).toEqual([]);
  });

  it("returns forbidden for submit and self-review, and conflict for invalid stage transitions", async () => {
    const runtime = makeService([
      [
        "exp-1",
        {
          kind: "draft",
          id: "exp-1",
          ownerId: "emp-1",
          ownerEmail: "owner@example.com",
          description: "trip",
          amountCents: 5000,
        },
      ],
      [
        "exp-2",
        {
          kind: "submitted",
          id: "exp-2",
          ownerId: "emp-1",
          ownerEmail: "owner@example.com",
          description: "hotel",
          amountCents: 9000,
        },
      ],
      [
        "exp-3",
        {
          kind: "paid",
          id: "exp-3",
          ownerId: "emp-1",
          ownerEmail: "owner@example.com",
          description: "flight",
          amountCents: 12000,
          reviewerId: "emp-2",
          receiptId: "rcpt-1",
        },
      ],
    ]);

    const submitForbidden = await runtime.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-2",
    });
    const selfReview = await runtime.service.handle({
      op: "approve",
      id: "exp-2",
      actorId: "emp-1",
    });
    const paidReview = await runtime.service.handle({
      op: "reject",
      id: "exp-3",
      actorId: "emp-2",
      reason: "not needed",
    });

    expect(submitForbidden).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
    expect(selfReview).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
    expect(paidReview).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
  });

  it("declines payment without saving and allows another attempt", async () => {
    const runtime = makeService([
      [
        "exp-1",
        {
          kind: "approved",
          id: "exp-1",
          ownerId: "emp-1",
          ownerEmail: "owner@example.com",
          description: "supplies",
          amountCents: 8800,
          reviewerId: "emp-2",
        },
      ],
    ]);

    runtime.payment.setNext({ kind: "declined" });
    const declined = await runtime.service.handle({ op: "pay", id: "exp-1" });

    expect(declined).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });
    expect(runtime.repository.calls.save).toHaveLength(0);

    runtime.payment.setNext({ kind: "paid", receiptId: "rcpt-77" });
    const paid = await runtime.service.handle({ op: "pay", id: "exp-1" });

    expect(paid).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "supplies",
        amountCents: 8800,
        reviewerId: "emp-2",
        receiptId: "rcpt-77",
        state: "paid",
      },
    });
    expect(runtime.repository.calls.save).toHaveLength(1);
    expect(runtime.payment.calls).toHaveLength(2);
  });

  it("does not leak the owner email in responses or logger events", async () => {
    const runtime = makeService();

    const created = await runtime.service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-1",
      ownerEmail: "secret@example.com",
      description: "meal",
      amountCents: 1000,
    });

    expect(JSON.stringify(created)).not.toContain("secret@example.com");
    expect(JSON.stringify(runtime.logger.events)).not.toContain("secret@example.com");
    expect(runtime.logger.events[0]).toEqual({
      kind: "expense_event",
      expenseId: "exp-1",
      action: "created",
    });
  });
});
