import { err, ok, type Result } from "neverthrow";
import type { ExpenseResolver } from "../domain/expense-resolver";
import type { ExpenseStore } from "../domain/expense-store";
import { Expense, type ApprovedExpense, type Expense as ExpenseState } from "../domain/expense";
import type { PaymentResponse } from "../infrastructure/payment-codec";
import type { AmountCents, Email, EmployeeId, ExpenseId } from "../domain/value-objects";
import type { Command } from "./commands";

export type PaymentGateway = Readonly<{
  charge: (request: {
    readonly expenseId: ExpenseId;
    readonly amountCents: AmountCents;
    readonly email: Email;
    readonly idempotencyKey: ExpenseId;
  }) => Promise<PaymentResponse>;
}>;

export type UseCaseSuccess = Readonly<{
  expense: ExpenseState;
  action?: "created" | "submitted" | "approved" | "rejected" | "paid";
}>;

type NotFound = Readonly<{ kind: "NotFound" }>;
type Conflict = Readonly<{ kind: "Conflict" }>;
type Unauthorized = Readonly<{ kind: "Unauthorized" }>;
type PaymentDeclined = Readonly<{ kind: "PaymentDeclined" }>;

export type UseCaseError = NotFound | Conflict | Unauthorized | PaymentDeclined;

const ensureFound = (
  expense: ExpenseState | undefined,
): Result<ExpenseState, NotFound> =>
  expense === undefined ? err({ kind: "NotFound" }) : ok(expense);

const sameEmployee = (left: EmployeeId, right: EmployeeId): boolean => left === right;

const saveSuccess = async (
  store: ExpenseStore,
  expense: ExpenseState,
  action: UseCaseSuccess["action"],
): Promise<Result<UseCaseSuccess, never>> => {
  await store.save(expense);
  return ok({ expense, action });
};

export const createExpense = async (
  resolver: ExpenseResolver,
  store: ExpenseStore,
  command: Extract<Command, { op: "create" }>,
): Promise<Result<UseCaseSuccess, Conflict>> => {
  const existing = await resolver.findById(command.id);
  if (existing !== undefined) {
    return err({ kind: "Conflict" });
  }

  return saveSuccess(
    store,
    Expense.create(
      command.id,
      command.ownerId,
      command.ownerEmail,
      command.description,
      command.amountCents,
    ),
    "created",
  );
};

export const getExpense = async (
  resolver: ExpenseResolver,
  command: Extract<Command, { op: "get" }>,
): Promise<Result<UseCaseSuccess, NotFound>> => {
  const expense = await resolver.findById(command.id);
  return ensureFound(expense).map((found) => ({ expense: found }));
};

export const submitExpense = async (
  resolver: ExpenseResolver,
  store: ExpenseStore,
  command: Extract<Command, { op: "submit" }>,
): Promise<Result<UseCaseSuccess, NotFound | Unauthorized | Conflict>> => {
  const expense = await resolver.findById(command.id);
  if (expense === undefined) {
    return err({ kind: "NotFound" });
  }
  if (!sameEmployee(expense.ownerId, command.actorId)) {
    return err({ kind: "Unauthorized" });
  }
  if (expense.kind !== "Draft") {
    return err({ kind: "Conflict" });
  }
  return saveSuccess(store, Expense.submit(expense), "submitted");
};

export const approveExpense = async (
  resolver: ExpenseResolver,
  store: ExpenseStore,
  command: Extract<Command, { op: "approve" }>,
): Promise<Result<UseCaseSuccess, NotFound | Unauthorized | Conflict>> => {
  const expense = await resolver.findById(command.id);
  if (expense === undefined) {
    return err({ kind: "NotFound" });
  }
  if (sameEmployee(expense.ownerId, command.actorId)) {
    return err({ kind: "Unauthorized" });
  }
  if (expense.kind !== "Submitted") {
    return err({ kind: "Conflict" });
  }
  return saveSuccess(store, Expense.approve(expense, command.actorId), "approved");
};

export const rejectExpense = async (
  resolver: ExpenseResolver,
  store: ExpenseStore,
  command: Extract<Command, { op: "reject" }>,
): Promise<Result<UseCaseSuccess, NotFound | Unauthorized | Conflict>> => {
  const expense = await resolver.findById(command.id);
  if (expense === undefined) {
    return err({ kind: "NotFound" });
  }
  if (sameEmployee(expense.ownerId, command.actorId)) {
    return err({ kind: "Unauthorized" });
  }
  if (expense.kind !== "Submitted") {
    return err({ kind: "Conflict" });
  }
  return saveSuccess(
    store,
    Expense.reject(expense, command.actorId, command.reason),
    "rejected",
  );
};

const chargeApprovedExpense = async (
  payment: PaymentGateway,
  approved: ApprovedExpense,
): Promise<Result<UseCaseSuccess, PaymentDeclined>> => {
  const response = await payment.charge({
    expenseId: approved.id,
    amountCents: approved.amountCents,
    email: approved.ownerEmail.unwrap(),
    idempotencyKey: approved.id,
  });

  return response.kind === "declined"
    ? err({ kind: "PaymentDeclined" })
    : ok({ expense: Expense.markPaid(approved, response.receiptId), action: "paid" });
};

export const payExpense = async (
  resolver: ExpenseResolver,
  store: ExpenseStore,
  payment: PaymentGateway,
  command: Extract<Command, { op: "pay" }>,
): Promise<Result<UseCaseSuccess, NotFound | Conflict | PaymentDeclined>> => {
  const expense = await resolver.findById(command.id);
  if (expense === undefined) {
    return err({ kind: "NotFound" });
  }
  if (expense.kind === "Paid") {
    return ok({ expense });
  }
  if (expense.kind !== "Approved") {
    return err({ kind: "Conflict" });
  }

  const charged = await chargeApprovedExpense(payment, expense);
  if (charged.isErr()) {
    return err(charged.error);
  }

  await store.save(charged.value.expense);
  return ok(charged.value);
};
