import { describe, expect, test } from "bun:test";
import { AmountCents, type AmountCents as AmountCentsType } from "./amount-cents";
import { EmployeeId, type EmployeeId as EmployeeIdType } from "./employee-id";
import { EmailAddress, type EmailAddress as EmailAddressType } from "./email-address";
import { ExpenseDescription, type ExpenseDescription as ExpenseDescriptionType } from "./expense-description";
import { ExpenseId, type ExpenseId as ExpenseIdType } from "./expense-id";
import { Expense, type ExpenseEvent, type ExpenseRecord } from "./expense";
import { createExpenseService } from "./index";
import type { Result } from "./result";

const must = <T, E>(result: Result<T, E>): T => {
  if (result.kind === "ok") {
    return result.value;
  }

  throw new Error("Unexpected parse failure");
};

const expenseId = (value: string): ExpenseIdType => must(ExpenseId.parse(value));
const employeeId = (value: string): EmployeeIdType => must(EmployeeId.parse(value));
const emailAddress = (value: string): EmailAddressType => must(EmailAddress.parse(value));
const description = (value: string): ExpenseDescriptionType => must(ExpenseDescription.parse(value));
const amountCents = (value: number): AmountCentsType => must(AmountCents.parse(value));

const makeExpense = (state: ExpenseRecord["state"]): ExpenseRecord => ({
  kind: "Expense",
  id: expenseId("exp-1"),
  ownerId: employeeId("emp-owner"),
  ownerEmail: emailAddress("owner@example.com"),
  description: description("Train fare"),
  amountCents: amountCents(1250),
  state,
});

const createHarness = (seed?: ReadonlyArray<ExpenseRecord>) => {
  const store = new Map<string, any>();
  for (const record of seed ?? []) {
    store.set(record.id, record);
  }

  const saveCalls: Array<{ id: ExpenseIdType; value: ExpenseRecord }> = [];
  const getCalls: ExpenseIdType[] = [];
  const logs: ExpenseEvent[] = [];
  const chargeCalls: Array<{
    expenseId: ExpenseIdType;
    amountCents: AmountCentsType;
    email: EmailAddressType;
    idempotencyKey: ExpenseIdType;
  }> = [];

  let nextPayment: unknown = { kind: "paid", receiptId: "receipt-1" };
  let failGet = false;
  let failSave = false;
  let failCharge = false;

  const repository = {
    get: async (id: ExpenseIdType) => {
      getCalls.push(id);
      if (failGet) {
        throw new Error("repository unavailable");
      }

      return store.get(String(id));
    },
    save: async (id: ExpenseIdType, value: ExpenseRecord) => {
      saveCalls.push({ id, value });
      if (failSave) {
        throw new Error("repository unavailable");
      }

      store.set(String(id), value);
    },
  };

  const payment = {
    charge: async (args: {
      expenseId: ExpenseIdType;
      amountCents: AmountCentsType;
      email: EmailAddressType;
      idempotencyKey: ExpenseIdType;
    }) => {
      chargeCalls.push(args);
      if (failCharge) {
        throw new Error("gateway unavailable");
      }

      return nextPayment;
    },
  };

  const logger = {
    info: (event: ExpenseEvent) => {
      logs.push(event);
    },
  };

  const service = createExpenseService({ repository, payment, logger });

  return {
    service,
    store,
    saveCalls,
    getCalls,
    logs,
    chargeCalls,
    setPaymentResponse: (value: unknown) => {
      nextPayment = value;
    },
    setRepositoryFailure: (value: boolean) => {
      failGet = value;
      failSave = value;
    },
    setGatewayFailure: (value: boolean) => {
      failCharge = value;
    },
  };
};

describe("expense service", () => {
  test("creates an expense, stores the email privately, and logs the action", async () => {
    const harness = createHarness();

    const response = await harness.service.handle({
      op: "create",
      id: "exp-1",
      ownerId: "emp-owner",
      ownerEmail: "owner@example.com",
      description: "Train fare",
      amountCents: 1250,
      ignored: "field",
    });

    expect(response).toEqual({
      status: 201,
      body: {
        id: expenseId("exp-1"),
        ownerId: employeeId("emp-owner"),
        description: description("Train fare"),
        amountCents: amountCents(1250),
        state: "draft",
      },
    });
    expect("ownerEmail" in response.body).toBe(false);
    expect(harness.saveCalls).toHaveLength(1);
    expect(harness.chargeCalls).toHaveLength(0);
    expect(harness.logs).toEqual([
      {
        kind: "expense_event",
        action: "created",
        expenseId: expenseId("exp-1"),
      },
    ]);
    expect("email" in harness.logs[0]).toBe(false);

    const stored = harness.store.get("exp-1");
    expect(stored?.ownerEmail).toBe("owner@example.com");
  });

  test("rejects invalid commands before touching storage", async () => {
    const harness = createHarness();

    const response = await harness.service.handle({
      op: "create",
      id: "exp-2",
      ownerId: "emp-owner",
      ownerEmail: "not-an-email",
      description: "Lunch",
      amountCents: 10,
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.getCalls).toHaveLength(0);
    expect(harness.saveCalls).toHaveLength(0);
    expect(harness.logs).toHaveLength(0);
  });

  test("requires every submit field even when the expense does not exist", async () => {
    const harness = createHarness();

    const response = await harness.service.handle({
      op: "submit",
      id: "missing",
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.getCalls).toHaveLength(0);
  });

  test("enforces submit ownership and review stage rules", async () => {
    const harness = createHarness([makeExpense({ kind: "draft" })]);

    const forbidden = await harness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-other",
    });

    expect(forbidden).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
    expect(harness.saveCalls).toHaveLength(0);

    const submitted = await harness.service.handle({
      op: "submit",
      id: "exp-1",
      actorId: "emp-owner",
    });
    expect(submitted).toEqual({
      status: 200,
      body: {
        id: expenseId("exp-1"),
        ownerId: employeeId("emp-owner"),
        description: description("Train fare"),
        amountCents: amountCents(1250),
        state: "submitted",
      },
    });
    expect(harness.logs.at(-1)).toEqual({
      kind: "expense_event",
      action: "submitted",
      expenseId: expenseId("exp-1"),
    });

    const approved = await harness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-reviewer",
    });
    expect(approved).toEqual({
      status: 200,
      body: {
        id: expenseId("exp-1"),
        ownerId: employeeId("emp-owner"),
        description: description("Train fare"),
        amountCents: amountCents(1250),
        state: "approved",
        reviewerId: employeeId("emp-reviewer"),
      },
    });

    const selfReview = await harness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-owner",
    });
    expect(selfReview).toEqual({
      status: 403,
      body: { code: "forbidden" },
    });
  });

  test("rejecting is final and carries the reviewer and reason", async () => {
    const harness = createHarness([makeExpense({ kind: "submitted" })]);

    const rejected = await harness.service.handle({
      op: "reject",
      id: "exp-1",
      actorId: "emp-reviewer",
      reason: "Duplicate receipt",
    });

    expect(rejected).toEqual({
      status: 200,
      body: {
        id: expenseId("exp-1"),
        ownerId: employeeId("emp-owner"),
        description: description("Train fare"),
        amountCents: amountCents(1250),
        state: "rejected",
        reviewerId: employeeId("emp-reviewer"),
        reason: "Duplicate receipt",
      },
    });

    const approveAfterReject = await harness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-reviewer",
    });
    expect(approveAfterReject).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
  });

  test("pays an approved expense once and reuses the receipt on repeat", async () => {
    const harness = createHarness([makeExpense({ kind: "approved", reviewerId: employeeId("emp-reviewer") })]);
    harness.setPaymentResponse({ kind: "paid", receiptId: "rcpt-123" });

    const first = await harness.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(first).toEqual({
      status: 200,
      body: {
        id: expenseId("exp-1"),
        ownerId: employeeId("emp-owner"),
        description: description("Train fare"),
        amountCents: amountCents(1250),
        state: "paid",
        receiptId: "rcpt-123",
      },
    });
    expect(harness.chargeCalls).toHaveLength(1);
    expect(harness.chargeCalls[0]).toEqual({
      expenseId: expenseId("exp-1"),
      amountCents: amountCents(1250),
      email: emailAddress("owner@example.com"),
      idempotencyKey: expenseId("exp-1"),
    });
    expect(harness.logs.at(-1)).toEqual({
      kind: "expense_event",
      action: "paid",
      expenseId: expenseId("exp-1"),
    });

    const saveCount = harness.saveCalls.length;
    const second = await harness.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(second).toEqual(first);
    expect(harness.chargeCalls).toHaveLength(1);
    expect(harness.saveCalls).toHaveLength(saveCount);

    const approveAfterPaid = await harness.service.handle({
      op: "approve",
      id: "exp-1",
      actorId: "emp-reviewer-2",
    });
    expect(approveAfterPaid).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
  });

  test("returns payment declined without saving the expense", async () => {
    const harness = createHarness([makeExpense({ kind: "approved", reviewerId: employeeId("emp-reviewer") })]);
    harness.setPaymentResponse({ kind: "declined" });

    const response = await harness.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(response).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });
    expect(harness.saveCalls).toHaveLength(0);
    expect(harness.logs).toHaveLength(0);
  });

  test("fails when the payment gateway returns an unusable response", async () => {
    const harness = createHarness([makeExpense({ kind: "approved", reviewerId: employeeId("emp-reviewer") })]);
    harness.setPaymentResponse({ kind: "paid", receiptId: "" });

    const response = await harness.service.handle({
      op: "pay",
      id: "exp-1",
    });

    expect(response).toEqual({
      status: 500,
      body: { code: "invalid_gateway_response" },
    });
    expect(harness.saveCalls).toHaveLength(0);
  });

  test("returns missing for absent records and keeps malformed storage private", async () => {
    const harness = createHarness();

    const missing = await harness.service.handle({
      op: "get",
      id: "missing",
    });
    expect(missing).toEqual({
      status: 404,
      body: { code: "not_found" },
    });

    harness.store.set("exp-bad", {
      kind: "Expense",
      id: "exp-bad",
      ownerId: "emp-owner",
      ownerEmail: "broken-email",
      description: "Bad",
      amountCents: 1,
      state: { kind: "draft" },
    });

    const malformed = await harness.service.handle({
      op: "get",
      id: "exp-bad",
    });
    expect(malformed).toEqual({
      status: 500,
      body: { code: "storage_unavailable" },
    });
  });

  test("maps repository and gateway failures to 500 responses", async () => {
    const harness = createHarness([makeExpense({ kind: "draft" })]);
    harness.setRepositoryFailure(true);

    const repositoryFailure = await harness.service.handle({
      op: "get",
      id: "exp-1",
    });
    expect(repositoryFailure).toEqual({
      status: 500,
      body: { code: "storage_unavailable" },
    });

    harness.setRepositoryFailure(false);
    harness.setGatewayFailure(true);
    harness.store.set("exp-1", makeExpense({ kind: "approved", reviewerId: employeeId("emp-reviewer") }));

    const gatewayFailure = await harness.service.handle({
      op: "pay",
      id: "exp-1",
    });
    expect(gatewayFailure).toEqual({
      status: 500,
      body: { code: "gateway_unavailable" },
    });
  });
});
