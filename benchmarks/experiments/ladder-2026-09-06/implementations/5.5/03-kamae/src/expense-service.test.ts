import { describe, expect, test } from "bun:test";
import { createExpenseService } from "./index";
import type { CreateExpenseServiceDependencies } from "./index";

type ChargeRequest = Readonly<{
  expenseId: string;
  amountCents: number;
  email: string;
  idempotencyKey: string;
}>;

const createHarness = (
  options: Readonly<{
    repositoryGet?: CreateExpenseServiceDependencies["repository"]["get"];
    repositorySave?: CreateExpenseServiceDependencies["repository"]["save"];
    paymentCharge?: CreateExpenseServiceDependencies["payment"]["charge"];
  }> = {},
) => {
  const stored = new Map<string, unknown>();
  const events: unknown[] = [];
  const charges: ChargeRequest[] = [];
  let getCount = 0;
  let saveCount = 0;

  const repository = {
    get: async (id: string) => {
      getCount += 1;
      return options.repositoryGet === undefined
        ? stored.get(id)
        : options.repositoryGet(id);
    },
    save: async (id: string, value: unknown) => {
      saveCount += 1;
      if (options.repositorySave === undefined) {
        stored.set(id, value);
      } else {
        await options.repositorySave(id, value);
      }
    },
  };

  const payment = {
    charge: async (charge: ChargeRequest) => {
      charges.push(charge);
      return options.paymentCharge === undefined
        ? { kind: "paid", receiptId: "receipt-1" }
        : options.paymentCharge(charge);
    },
  };

  const logger = {
    info: (event: unknown) => {
      events.push(event);
    },
  };

  return {
    service: createExpenseService({ repository, payment, logger }),
    stored,
    events,
    charges,
    counts: {
      get: () => getCount,
      save: () => saveCount,
    },
  };
};

const validCreateCommand = {
  op: "create",
  id: "expense-1",
  ownerId: "employee-1",
  ownerEmail: "owner@example.com",
  description: "Client dinner",
  amountCents: 4_250,
} as const;

describe("expense approval service", () => {
  test("creates drafts, rejects duplicate IDs, and keeps email out of responses and logs", async () => {
    const harness = createHarness();

    const created = await harness.service.handle(validCreateCommand);
    expect(created).toEqual({
      status: 201,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 4_250,
        state: "draft",
      },
    });

    const duplicate = await harness.service.handle(validCreateCommand);
    expect(duplicate).toEqual({ status: 409, body: { code: "conflict" } });
    expect(harness.counts.save()).toBe(1);
    expect(JSON.stringify(created)).not.toContain("owner@example.com");
    expect(JSON.stringify(harness.events)).not.toContain("owner@example.com");
    expect(harness.events).toEqual([
      { expenseId: "expense-1", action: "created" },
    ]);
  });

  test("validates required fields before repository access", async () => {
    const harness = createHarness();

    const response = await harness.service.handle({
      op: "get",
      id: "  ",
    });

    expect(response).toEqual({
      status: 400,
      body: { code: "invalid_command" },
    });
    expect(harness.counts.get()).toBe(0);
    expect(harness.counts.save()).toBe(0);
  });

  test("submits drafts only by the owner", async () => {
    const harness = createHarness();
    await harness.service.handle(validCreateCommand);

    const forbidden = await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-2",
    });
    expect(forbidden).toEqual({ status: 403, body: { code: "forbidden" } });

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
        description: "Client dinner",
        amountCents: 4_250,
        state: "submitted",
      },
    });

    const repeat = await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-1",
    });
    expect(repeat).toEqual({ status: 409, body: { code: "conflict" } });
  });

  test("reviews submitted expenses by a different employee and makes rejection final", async () => {
    const harness = createHarness();
    await harness.service.handle(validCreateCommand);
    await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-1",
    });

    const selfReview = await harness.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-1",
    });
    expect(selfReview).toEqual({ status: 403, body: { code: "forbidden" } });

    const rejected = await harness.service.handle({
      op: "reject",
      id: "expense-1",
      actorId: "employee-2",
      reason: "Missing receipt",
    });
    expect(rejected).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 4_250,
        state: "rejected",
        reviewerId: "employee-2",
        reason: "Missing receipt",
      },
    });

    const approveAfterReject = await harness.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-3",
    });
    expect(approveAfterReject).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
  });

  test("pays approved expenses with the stored amount and email, then returns retained receipts idempotently", async () => {
    const harness = createHarness();
    await harness.service.handle(validCreateCommand);
    await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-1",
    });
    await harness.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-2",
    });

    const paid = await harness.service.handle({ op: "pay", id: "expense-1" });
    expect(paid).toEqual({
      status: 200,
      body: {
        id: "expense-1",
        ownerId: "employee-1",
        description: "Client dinner",
        amountCents: 4_250,
        state: "paid",
        reviewerId: "employee-2",
        receiptId: "receipt-1",
      },
    });
    expect(harness.charges).toEqual([
      {
        expenseId: "expense-1",
        amountCents: 4_250,
        email: "owner@example.com",
        idempotencyKey: "expense-1",
      },
    ]);

    const writesAfterFirstPay = harness.counts.save();
    const logsAfterFirstPay = harness.events.length;
    const repeated = await harness.service.handle({ op: "pay", id: "expense-1" });
    expect(repeated).toEqual(paid);
    expect(harness.charges).toHaveLength(1);
    expect(harness.counts.save()).toBe(writesAfterFirstPay);
    expect(harness.events).toHaveLength(logsAfterFirstPay);
  });

  test("payment decline is retryable and does not save a paid state", async () => {
    let attempt = 0;
    const harness = createHarness({
      paymentCharge: async () => {
        attempt += 1;
        return attempt === 1
          ? { kind: "declined" }
          : { kind: "paid", receiptId: "receipt-2" };
      },
    });
    await harness.service.handle(validCreateCommand);
    await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-1",
    });
    await harness.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-2",
    });

    const declined = await harness.service.handle({ op: "pay", id: "expense-1" });
    expect(declined).toEqual({
      status: 422,
      body: { code: "payment_declined" },
    });

    const paid = await harness.service.handle({ op: "pay", id: "expense-1" });
    expect(paid).toMatchObject({
      status: 200,
      body: { state: "paid", receiptId: "receipt-2" },
    });
    expect(harness.charges).toHaveLength(2);
  });

  test("get retrieves stages without disclosing owner email", async () => {
    const harness = createHarness();
    await harness.service.handle(validCreateCommand);
    await harness.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-1",
    });
    await harness.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-2",
    });

    const response = await harness.service.handle({ op: "get", id: "expense-1" });
    expect(response).toMatchObject({
      status: 200,
      body: { state: "approved", reviewerId: "employee-2" },
    });
    expect(JSON.stringify(response)).not.toContain("owner@example.com");
  });

  test("missing expenses and unavailable operations use the required status codes", async () => {
    const harness = createHarness();

    expect(await harness.service.handle({ op: "get", id: "missing" })).toEqual({
      status: 404,
      body: { code: "not_found" },
    });

    await harness.service.handle(validCreateCommand);
    expect(await harness.service.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 409,
      body: { code: "conflict" },
    });
  });

  test("storage and gateway failures map to service unavailable", async () => {
    const unavailableStorage = createHarness({
      repositoryGet: async () => {
        throw new Error("storage down");
      },
    });
    expect(
      await unavailableStorage.service.handle({ op: "get", id: "expense-1" }),
    ).toEqual({ status: 500, body: { code: "service_unavailable" } });

    const malformedStorage = createHarness({
      repositoryGet: async () => ({ kind: "DraftExpense", id: "" }),
    });
    expect(
      await malformedStorage.service.handle({ op: "get", id: "expense-1" }),
    ).toEqual({ status: 500, body: { code: "service_unavailable" } });

    const badGateway = createHarness({
      paymentCharge: async () => ({ kind: "paid", receiptId: "" }),
    });
    await badGateway.service.handle(validCreateCommand);
    await badGateway.service.handle({
      op: "submit",
      id: "expense-1",
      actorId: "employee-1",
    });
    await badGateway.service.handle({
      op: "approve",
      id: "expense-1",
      actorId: "employee-2",
    });

    const writesBeforePay = badGateway.counts.save();
    expect(await badGateway.service.handle({ op: "pay", id: "expense-1" })).toEqual({
      status: 500,
      body: { code: "service_unavailable" },
    });
    expect(badGateway.counts.save()).toBe(writesBeforePay);
  });
});

