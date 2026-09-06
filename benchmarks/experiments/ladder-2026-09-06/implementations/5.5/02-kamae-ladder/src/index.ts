import { Command, type Command as ParsedCommand } from "./api/commands";
import type { ExpenseServiceDependencies } from "./api/dependencies";
import { Response, type HandleResponse } from "./api/response";
import { Expense, type ApprovedExpense, type Expense as ExpenseState } from "./domain/expense";
import { ReceiptId } from "./domain/receipt-id";
import { StoredExpense } from "./storage/stored-expense";

type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<HandleResponse>;
}>;

const getExisting = async (
  dependencies: ExpenseServiceDependencies,
  id: string,
): Promise<ExpenseState | "missing" | "invalid"> => {
  const raw = await dependencies.repository.get(id);
  if (raw === undefined) return "missing";

  const expense = StoredExpense.parse(raw);
  return expense ?? "invalid";
};

const saveAndLog = async (
  dependencies: ExpenseServiceDependencies,
  expense: ExpenseState,
  action: string,
): Promise<void> => {
  await dependencies.repository.save(expense.id, StoredExpense.fromExpense(expense));
  dependencies.logger.info({ expenseId: expense.id, action });
};

const transitionErrorResponse = (error: Readonly<{ kind: string }>): HandleResponse => {
  switch (error.kind) {
    case "unauthorized_submit":
    case "self_review":
      return Response.error(403, error.kind);
    case "invalid_state":
      return Response.error(409, "invalid_state");
    default:
      return Response.error(500, "internal_error");
  }
};

const loadForMutation = async (
  dependencies: ExpenseServiceDependencies,
  id: string,
): Promise<ExpenseState | HandleResponse> => {
  const existing = await getExisting(dependencies, id);
  if (existing === "missing") return Response.error(404, "missing_expense");
  if (existing === "invalid") return Response.error(500, "storage_unavailable");
  return existing;
};

const handleCreate = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<ParsedCommand, { op: "create" }>,
): Promise<HandleResponse> => {
  const existing = await getExisting(dependencies, command.id);
  if (existing === "invalid") return Response.error(500, "storage_unavailable");
  if (existing !== "missing") return Response.error(409, "duplicate_id");

  const expense = Expense.createDraft(
    command.id,
    command.ownerId,
    command.ownerEmail,
    command.description,
    command.amountCents,
  );
  await saveAndLog(dependencies, expense, "created");
  return Response.success(201, Expense.toView(expense));
};

const handleSubmit = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<ParsedCommand, { op: "submit" }>,
): Promise<HandleResponse> => {
  const existing = await loadForMutation(dependencies, command.id);
  if ("status" in existing) return existing;

  const submitted = Expense.submit(existing, command.actorId);
  if (submitted.kind !== "submitted") {
    return transitionErrorResponse(submitted);
  }

  await saveAndLog(dependencies, submitted, "submitted");
  return Response.success(200, Expense.toView(submitted));
};

const handleApprove = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<ParsedCommand, { op: "approve" }>,
): Promise<HandleResponse> => {
  const existing = await loadForMutation(dependencies, command.id);
  if ("status" in existing) return existing;

  const approved = Expense.approve(existing, command.actorId);
  if (approved.kind !== "approved") {
    return transitionErrorResponse(approved);
  }

  await saveAndLog(dependencies, approved, "approved");
  return Response.success(200, Expense.toView(approved));
};

const handleReject = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<ParsedCommand, { op: "reject" }>,
): Promise<HandleResponse> => {
  const existing = await loadForMutation(dependencies, command.id);
  if ("status" in existing) return existing;

  const rejected = Expense.reject(existing, command.actorId, command.reason);
  if (rejected.kind !== "rejected") {
    return transitionErrorResponse(rejected);
  }

  await saveAndLog(dependencies, rejected, "rejected");
  return Response.success(200, Expense.toView(rejected));
};

const chargeApprovedExpense = async (
  dependencies: ExpenseServiceDependencies,
  expense: ApprovedExpense,
): Promise<HandleResponse> => {
  const paymentResult = await dependencies.payment.charge({
    expenseId: expense.id,
    amountCents: expense.amountCents,
    email: expense.ownerEmail.unwrap(),
    idempotencyKey: expense.id,
  });

  if (paymentResult.kind === "declined") return Response.error(422, "payment_declined");
  if (paymentResult.kind !== "paid") return Response.error(500, "payment_unavailable");

  const receiptId = ReceiptId.schema.safeParse(paymentResult.receiptId);
  if (!receiptId.success) return Response.error(500, "payment_unavailable");

  const paid = Expense.pay(expense, receiptId.data);
  await saveAndLog(dependencies, paid, "paid");
  return Response.success(200, Expense.toView(paid));
};

const handlePay = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<ParsedCommand, { op: "pay" }>,
): Promise<HandleResponse> => {
  const existing = await loadForMutation(dependencies, command.id);
  if ("status" in existing) return existing;

  if (existing.kind === "paid") return Response.success(200, Expense.toView(existing));
  if (existing.kind !== "approved") return Response.error(409, "invalid_state");

  return chargeApprovedExpense(dependencies, existing);
};

const handleGet = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<ParsedCommand, { op: "get" }>,
): Promise<HandleResponse> => {
  const existing = await getExisting(dependencies, command.id);
  if (existing === "missing") return Response.error(404, "missing_expense");
  if (existing === "invalid") return Response.error(500, "storage_unavailable");

  return Response.success(200, Expense.toView(existing));
};

const route = async (
  dependencies: ExpenseServiceDependencies,
  command: ParsedCommand,
): Promise<HandleResponse> => {
  switch (command.op) {
    case "create":
      return handleCreate(dependencies, command);
    case "submit":
      return handleSubmit(dependencies, command);
    case "approve":
      return handleApprove(dependencies, command);
    case "reject":
      return handleReject(dependencies, command);
    case "pay":
      return handlePay(dependencies, command);
    case "get":
      return handleGet(dependencies, command);
  }
};

export const createExpenseService = (dependencies: ExpenseServiceDependencies): ExpenseService => ({
  handle: async (rawCommand: unknown) => {
    try {
      const command = Command.parse(rawCommand);
      if (!command.success) return Response.error(400, "invalid_command");

      return await route(dependencies, command.data);
    } catch {
      return Response.error(500, "service_unavailable");
    }
  },
});

export type { ExpenseService, ExpenseServiceDependencies, HandleResponse };
