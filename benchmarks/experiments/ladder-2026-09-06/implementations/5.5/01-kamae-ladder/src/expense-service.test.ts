import { describe, expect, test } from "bun:test";
import { createExpenseService, type ExpenseServiceDependencies } from "./index";

const createCommand = {
  op: "create",
  id: "exp-1",
  ownerId: "emp-1",
  ownerEmail: "owner@example.com",
  description: "Taxi to client site",
  amountCents: 4250,
} as const;

type Harness = Readonly<{
  service: ReturnType<typeof createExpenseService>;
  stored: Map<string, unknown>;
  calls: {
    get: string[];
    save: string[];
    charge: unknown[];
    logs: unknown[];
  };
  paymentResults: unknown[];
  failures: {
    get?: Error;
    save?: Error;
    charge?: Error;
  };
}>;

const makeHarness = (): Harness => {
  const stored = new Map<string, unknown>();
  const calls: Harness["calls"] = {
    get: [],
    save: [],
    charge: [],
    logs: [],
  };
  const paymentResults: unknown[] = [{ kind: "paid", receiptId: "rcpt-1" }];
  const failures: Harness["failures"] = {};

  const dependencies: ExpenseServiceDependencies = {
    repository: {
      get: async (id) => {
        calls.get.push(id);
        if (failures.get !== undefined) {
          throw failures.get;
        }
        return stored.get(id);
      },
      save: async (id, value) => {
        calls.save.push(id);
        if (failures.save !== undefined) {
          throw failures.save;
        }
        stored.set(id, value);
      },
    },
    payment: {
      charge: async (request) => {
        calls.charge.push(request);
        if (failures.charge !== undefined) {
          throw failures.charge;
        }
        return paymentResults.shift() ?? { kind: "paid", receiptId: "rcpt-default" };
      },
    },
    logger: {
      info: (event) => {
        calls.logs.push(event);
      },
    },
  };

  return {
    service: createExpenseService(dependencies),
    stored,
    calls,
    paymentResults,
    failures,
  };
};

const createSubmitted = async (harness: Harness) => {
  await harness.service.handle(createCommand);
  await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" });
};

const createApproved = async (harness: Harness) => {
  await createSubmitted(harness);
  await harness.service.handle({ op: "approve", id: "exp-1", actorId: "emp-2" });
};

describe("expense service", () => {
  test("creates a draft expense without exposing email in response or logs", async () => {
    const harness = makeHarness();

    const response = await harness.service.handle({
      ...createCommand,
      ignored: "value",
    });

    expect(response).toEqual({
      status: 201,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "Taxi to client site",
        amountCents: 4250,
        state: "draft",
      },
    });
    expect(JSON.stringify(response)).not.toContain("owner@example.com");
    expect(JSON.stringify(harness.calls.logs)).not.toContain("owner@example.com");
    expect(harness.calls.logs).toEqual([
      { expenseId: "exp-1", action: "created" },
    ]);
  });

  test("rejects invalid commands before storage or payment", async () => {
    const harness = makeHarness();

    const response = await harness.service.handle({
      ...createCommand,
      ownerEmail: "not-email",
      amountCents: 0,
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.calls.get).toEqual([]);
    expect(harness.calls.save).toEqual([]);
    expect(harness.calls.charge).toEqual([]);
  });

  test("preserves the original record on duplicate create", async () => {
    const harness = makeHarness();
    await harness.service.handle(createCommand);

    const response = await harness.service.handle({
      ...createCommand,
      ownerId: "emp-9",
      ownerEmail: "other@example.com",
      description: "Changed",
    });
    const stored = await harness.service.handle({ op: "get", id: "exp-1" });

    expect(response).toEqual({ status: 409, body: { code: "conflict" } });
    expect(stored.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Taxi to client site",
      amountCents: 4250,
      state: "draft",
    });
    expect(harness.calls.save).toEqual(["exp-1"]);
  });

  test("validates required fields before checking whether an expense exists", async () => {
    const harness = makeHarness();

    const response = await harness.service.handle({ op: "submit", id: "missing" });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.calls.get).toEqual([]);
  });

  test("submits only by owner and only from draft", async () => {
    const harness = makeHarness();
    await harness.service.handle(createCommand);

    expect(
      await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-2" }),
    ).toEqual({ status: 403, body: { code: "forbidden" } });

    expect(
      await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" }),
    ).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "Taxi to client site",
        amountCents: 4250,
        state: "submitted",
      },
    });

    expect(
      await harness.service.handle({ op: "submit", id: "exp-1", actorId: "emp-1" }),
    ).toEqual({ status: 409, body: { code: "conflict" } });
  });

  test("reviews submitted expenses with self-review and final-state restrictions", async () => {
    const harness = makeHarness();
    await createSubmitted(harness);

    expect(
      await harness.service.handle({ op: "approve", id: "exp-1", actorId: "emp-1" }),
    ).toEqual({ status: 403, body: { code: "forbidden" } });
    expect(
      await harness.service.handle({
        op: "reject",
        id: "exp-1",
        actorId: "emp-2",
        reason: " ",
      }),
    ).toEqual({ status: 400, body: { code: "invalid_command" } });

    const rejected = await harness.service.handle({
      op: "reject",
      id: "exp-1",
      actorId: "emp-2",
      reason: "No receipt",
    });

    expect(rejected).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "Taxi to client site",
        amountCents: 4250,
        state: "rejected",
        reviewerId: "emp-2",
        reason: "No receipt",
      },
    });
    expect(
      await harness.service.handle({ op: "approve", id: "exp-1", actorId: "emp-3" }),
    ).toEqual({ status: 409, body: { code: "conflict" } });
  });

  test("pays approved expenses with the recorded amount, email, and idempotency key", async () => {
    const harness = makeHarness();
    await createApproved(harness);

    const response = await harness.service.handle({ op: "pay", id: "exp-1" });

    expect(response).toEqual({
      status: 200,
      body: {
        id: "exp-1",
        ownerId: "emp-1",
        description: "Taxi to client site",
        amountCents: 4250,
        state: "paid",
        reviewerId: "emp-2",
        receiptId: "rcpt-1",
      },
    });
    expect(harness.calls.charge).toEqual([
      {
        expenseId: "exp-1",
        amountCents: 4250,
        email: "owner@example.com",
        idempotencyKey: "exp-1",
      },
    ]);
    expect(JSON.stringify(response)).not.toContain("owner@example.com");
  });

  test("returns an existing receipt for repeated pay without charging or saving", async () => {
    const harness = makeHarness();
    await createApproved(harness);
    await harness.service.handle({ op: "pay", id: "exp-1" });
    const saveCount = harness.calls.save.length;
    const chargeCount = harness.calls.charge.length;

    const response = await harness.service.handle({ op: "pay", id: "exp-1" });

    expect(response.body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Taxi to client site",
      amountCents: 4250,
      state: "paid",
      reviewerId: "emp-2",
      receiptId: "rcpt-1",
    });
    expect(harness.calls.save).toHaveLength(saveCount);
    expect(harness.calls.charge).toHaveLength(chargeCount);
  });

  test("does not save declined payments and allows retry", async () => {
    const harness = makeHarness();
    harness.paymentResults.splice(
      0,
      harness.paymentResults.length,
      { kind: "declined" },
      { kind: "paid", receiptId: "rcpt-2" },
    );
    await createApproved(harness);
    const saveCount = harness.calls.save.length;

    expect(await harness.service.handle({ op: "pay", id: "exp-1" })).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });
    expect(harness.calls.save).toHaveLength(saveCount);

    expect((await harness.service.handle({ op: "pay", id: "exp-1" })).body).toEqual({
      id: "exp-1",
      ownerId: "emp-1",
      description: "Taxi to client site",
      amountCents: 4250,
      state: "paid",
      reviewerId: "emp-2",
      receiptId: "rcpt-2",
    });
  });

  test("maps missing records, unavailable dependencies, and malformed data", async () => {
    const harness = makeHarness();

    expect(await harness.service.handle({ op: "get", id: "missing" })).toEqual({
      status: 404,
      body: { code: "not_found" },
    });

    harness.failures.get = new Error("storage down");
    expect(await harness.service.handle({ op: "get", id: "missing" })).toEqual({
      status: 500,
      body: { code: "unavailable" },
    });

    harness.failures.get = undefined;
    harness.stored.set("bad", { kind: "Draft", id: "bad" });
    expect(await harness.service.handle({ op: "get", id: "bad" })).toEqual({
      status: 500,
      body: { code: "unavailable" },
    });
  });

  test("maps unusable gateway responses and payment rejections to 500", async () => {
    const malformed = makeHarness();
    malformed.paymentResults.splice(0, malformed.paymentResults.length, {
      kind: "paid",
      receiptId: "",
    });
    await createApproved(malformed);

    expect(await malformed.service.handle({ op: "pay", id: "exp-1" })).toEqual({
      status: 500,
      body: { code: "unavailable" },
    });

    const rejected = makeHarness();
    await createApproved(rejected);
    rejected.failures.charge = new Error("gateway down");

    expect(await rejected.service.handle({ op: "pay", id: "exp-1" })).toEqual({
      status: 500,
      body: { code: "unavailable" },
    });
  });
});
