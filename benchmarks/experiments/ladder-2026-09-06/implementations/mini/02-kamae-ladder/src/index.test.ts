import { expect, test } from "bun:test";
import { createExpenseService } from "./index";

type LoggerEvent = Readonly<{ kind: string; expenseId: string }>;

const createHarness = () => {
  const store = new Map<string, unknown>();
  const loggerEvents: LoggerEvent[] = [];
  const paymentCalls: Array<Readonly<{
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }>> = [];

  let paymentBehavior: (request: Readonly<{
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }>) => Promise<Readonly<{ kind: "paid"; receiptId: string } | { kind: "declined" }>> =
    async () => ({ kind: "paid", receiptId: "receipt-1" });

  const service = createExpenseService({
    repository: {
      get: async (id) => store.get(id),
      save: async (id, value) => {
        store.set(id, value);
      },
    },
    payment: {
      charge: async (request) => {
        paymentCalls.push(request);
        return paymentBehavior(request);
      },
    },
    logger: {
      info: (event) => {
        loggerEvents.push(event);
      },
    },
  });

  return {
    service,
    store,
    loggerEvents,
    paymentCalls,
    setPaymentBehavior: (
      next: typeof paymentBehavior,
    ) => {
      paymentBehavior = next;
    },
  };
};

const createCommand = {
  op: "create",
  id: "expense-1",
  ownerId: "employee-1",
  ownerEmail: "owner@example.com",
  description: "Team dinner",
  amountCents: 12500,
} as const;

test("validates each command shape before touching dependencies", async () => {
  const harness = createHarness();

  const cases = [
    {},
    { op: "create", id: "", ownerId: "employee-1", ownerEmail: "owner@example.com", description: "Team dinner", amountCents: 12500 },
    { op: "submit", id: "expense-1" },
    { op: "approve", id: "expense-1" },
    { op: "reject", id: "expense-1", actorId: "employee-2" },
    { op: "pay" },
    { op: "get" },
  ] as const;

  for (const command of cases) {
    const response = await harness.service.handle(command);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: "invalid_command" });
  }

  expect(harness.store.size).toBe(0);
  expect(harness.loggerEvents).toEqual([]);
  expect(harness.paymentCalls).toEqual([]);
});

test("create preserves the original expense on duplicate id", async () => {
  const harness = createHarness();

  const first = await harness.service.handle(createCommand);
  expect(first.status).toBe(201);
  expect(first.body).toEqual({
    id: "expense-1",
    ownerId: "employee-1",
    description: "Team dinner",
    amountCents: 12500,
    state: "draft",
  });

  const storedBefore = harness.store.get("expense-1");

  const duplicate = await harness.service.handle({
    ...createCommand,
    description: "Different",
    amountCents: 1,
  });

  expect(duplicate).toEqual({ status: 409, body: { code: "duplicate_id" } });
  expect(harness.store.get("expense-1")).toEqual(storedBefore);
  expect(harness.loggerEvents).toEqual([{ kind: "expense.created", expenseId: "expense-1" }]);
  expect(JSON.stringify(first.body)).not.toContain("owner@example.com");
  expect(JSON.stringify(duplicate)).not.toContain("owner@example.com");
});

test("submit, approve, and reject enforce state and authorization rules", async () => {
  const harness = createHarness();

  await harness.service.handle(createCommand);

  const unauthorizedSubmit = await harness.service.handle({
    op: "submit",
    id: "expense-1",
    actorId: "employee-2",
  });
  expect(unauthorizedSubmit).toEqual({ status: 403, body: { code: "forbidden" } });

  const submitted = await harness.service.handle({
    op: "submit",
    id: "expense-1",
    actorId: "employee-1",
  });
  expect(submitted).toEqual({
    status: 200,
    body: {
      id: "expense-1",
      ownerId: "employee-1",
      description: "Team dinner",
      amountCents: 12500,
      state: "submitted",
    },
  });

  const selfApprove = await harness.service.handle({
    op: "approve",
    id: "expense-1",
    actorId: "employee-1",
  });
  expect(selfApprove).toEqual({ status: 403, body: { code: "forbidden" } });

  const approved = await harness.service.handle({
    op: "approve",
    id: "expense-1",
    actorId: "employee-2",
  });
  expect(approved).toEqual({
    status: 200,
    body: {
      id: "expense-1",
      ownerId: "employee-1",
      description: "Team dinner",
      amountCents: 12500,
      state: "approved",
    },
  });

  const approvedReviewAttempt = await harness.service.handle({
    op: "reject",
    id: "expense-1",
    actorId: "employee-3",
    reason: "late",
  });
  expect(approvedReviewAttempt).toEqual({ status: 409, body: { code: "invalid_state" } });

  expect(harness.loggerEvents.map((event) => event.kind)).toEqual([
    "expense.created",
    "expense.submitted",
    "expense.approved",
  ]);
});

test("rejection records reviewer and reason and blocks later review", async () => {
  const harness = createHarness();

  await harness.service.handle({
    ...createCommand,
    id: "expense-2",
  });

  await harness.service.handle({
    op: "submit",
    id: "expense-2",
    actorId: "employee-1",
  });

  const rejected = await harness.service.handle({
    op: "reject",
    id: "expense-2",
    actorId: "employee-2",
    reason: "missing receipt",
  });

  expect(rejected).toEqual({
    status: 200,
    body: {
      id: "expense-2",
      ownerId: "employee-1",
      description: "Team dinner",
      amountCents: 12500,
      state: "rejected",
      reviewerId: "employee-2",
      reason: "missing receipt",
    },
  });

  const reviewAfterReject = await harness.service.handle({
    op: "approve",
    id: "expense-2",
    actorId: "employee-3",
  });
  expect(reviewAfterReject).toEqual({ status: 409, body: { code: "invalid_state" } });

  expect(JSON.stringify(rejected.body)).not.toContain("owner@example.com");
});

test("payment declines, retries, and idempotent repeats behave correctly", async () => {
  const harness = createHarness();

  await harness.service.handle({
    ...createCommand,
    id: "expense-3",
  });
  await harness.service.handle({
    op: "submit",
    id: "expense-3",
    actorId: "employee-1",
  });
  await harness.service.handle({
    op: "approve",
    id: "expense-3",
    actorId: "employee-2",
  });

  harness.setPaymentBehavior(async () => ({ kind: "declined" }));
  const declined = await harness.service.handle({
    op: "pay",
    id: "expense-3",
  });
  expect(declined).toEqual({ status: 422, body: { code: "payment_declined" } });
  expect(harness.paymentCalls).toHaveLength(1);
  expect(harness.store.get("expense-3")).toMatchObject({ kind: "approved" });

  harness.setPaymentBehavior(async () => ({ kind: "paid", receiptId: "receipt-77" }));
  const paid = await harness.service.handle({
    op: "pay",
    id: "expense-3",
  });
  expect(paid).toEqual({
    status: 200,
    body: {
      id: "expense-3",
      ownerId: "employee-1",
      description: "Team dinner",
      amountCents: 12500,
      state: "paid",
      receiptId: "receipt-77",
    },
  });
  expect(harness.paymentCalls).toHaveLength(2);
  expect(harness.store.get("expense-3")).toMatchObject({
    kind: "paid",
    receiptId: "receipt-77",
  });

  const beforeRepeatSave = harness.store.get("expense-3");
  const repeated = await harness.service.handle({
    op: "pay",
    id: "expense-3",
  });
  expect(repeated).toEqual(paid);
  expect(harness.paymentCalls).toHaveLength(2);
  expect(harness.store.get("expense-3")).toBe(beforeRepeatSave);
});

test("gateway failure and unusable responses return 500", async () => {
  const harness = createHarness();

  await harness.service.handle({
    ...createCommand,
    id: "expense-4",
  });
  await harness.service.handle({
    op: "submit",
    id: "expense-4",
    actorId: "employee-1",
  });
  await harness.service.handle({
    op: "approve",
    id: "expense-4",
    actorId: "employee-2",
  });

  harness.setPaymentBehavior(async () => {
    throw new Error("gateway offline");
  });
  const gatewayFailure = await harness.service.handle({
    op: "pay",
    id: "expense-4",
  });
  expect(gatewayFailure).toEqual({ status: 500, body: { code: "gateway_unavailable" } });

  harness.setPaymentBehavior(async () => ({ kind: "paid", receiptId: "" }));
  const unusableReceipt = await harness.service.handle({
    op: "pay",
    id: "expense-4",
  });
  expect(unusableReceipt).toEqual({ status: 500, body: { code: "invalid_gateway_response" } });
});

test("get returns every workflow state without exposing ownerEmail", async () => {
  const harness = createHarness();

  await harness.service.handle({
    ...createCommand,
    id: "expense-draft",
  });
  await harness.service.handle({
    ...createCommand,
    id: "expense-submitted",
  });
  await harness.service.handle({
    op: "submit",
    id: "expense-submitted",
    actorId: "employee-1",
  });
  await harness.service.handle({
    ...createCommand,
    id: "expense-approved",
  });
  await harness.service.handle({
    op: "submit",
    id: "expense-approved",
    actorId: "employee-1",
  });
  await harness.service.handle({
    op: "approve",
    id: "expense-approved",
    actorId: "employee-2",
  });
  await harness.service.handle({
    ...createCommand,
    id: "expense-rejected",
  });
  await harness.service.handle({
    op: "submit",
    id: "expense-rejected",
    actorId: "employee-1",
  });
  await harness.service.handle({
    op: "reject",
    id: "expense-rejected",
    actorId: "employee-2",
    reason: "policy",
  });
  await harness.service.handle({
    ...createCommand,
    id: "expense-paid",
  });
  await harness.service.handle({
    op: "submit",
    id: "expense-paid",
    actorId: "employee-1",
  });
  await harness.service.handle({
    op: "approve",
    id: "expense-paid",
    actorId: "employee-2",
  });
  await harness.service.handle({
    op: "pay",
    id: "expense-paid",
  });

  const cases = [
    ["expense-draft", "draft"],
    ["expense-submitted", "submitted"],
    ["expense-approved", "approved"],
    ["expense-rejected", "rejected"],
    ["expense-paid", "paid"],
  ] as const;

  for (const [id, state] of cases) {
    const response = await harness.service.handle({
      op: "get",
      id,
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) {
      throw new Error("expected successful get response");
    }
    expect(response.body.state).toBe(state);
    expect(JSON.stringify(response.body)).not.toContain("owner@example.com");
  }

  expect(harness.loggerEvents.every((event) => JSON.stringify(event).includes("owner@example.com") === false)).toBe(true);
});
