import { Command, type ParsedApproveCommand, type ParsedGetCommand, type ParsedPayCommand, type ParsedRejectCommand, type ParsedSubmitCommand, type ParsedCreateCommand } from "./domain/command";
import { ErrorResponse } from "./domain/errors";
import { Expense, type Expense as ExpenseValue } from "./domain/expense";
import { ExpenseResponse, type ExpenseBody } from "./domain/response";

type Repository = Readonly<{
  get: (id: string) => Promise<unknown>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

type Payment = Readonly<{
  charge: (request: Readonly<{
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }>) => Promise<Readonly<{ kind: "paid"; receiptId: string } | { kind: "declined" }>>;
}>;

type Logger = Readonly<{
  info: (event: Readonly<{ kind: string; expenseId: string }>) => void;
}>;

export type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<Readonly<{ status: 200 | 201; body: ExpenseBody } | { status: 400 | 403 | 404 | 409 | 422 | 500; body: Readonly<{ code: string }> }>>;
}>;

type Dependencies = Readonly<{
  repository: Repository;
  payment: Payment;
  logger: Logger;
}>;

const success = (status: 200 | 201, body: ExpenseBody) => ({ status, body });

const loadExpense = async (
  repository: Repository,
  id: string,
): Promise<ExpenseValue | { status: 400 | 403 | 404 | 409 | 422 | 500; body: Readonly<{ code: string }> }> => {
  try {
    const stored = await repository.get(id);
    if (stored === undefined) {
      return ErrorResponse.missing();
    }

    const expense = Expense.parseStored(stored);
    if (expense === undefined) {
      return ErrorResponse.unavailable("invalid_storage_record");
    }

    return expense;
  } catch {
    return ErrorResponse.unavailable("storage_unavailable");
  }
};

const saveExpense = async (
  repository: Repository,
  expense: ExpenseValue,
): Promise<{ status: 400 | 403 | 404 | 409 | 422 | 500; body: Readonly<{ code: string }> } | undefined> => {
  try {
    await repository.save(expense.id, expense);
    return undefined;
  } catch {
    return ErrorResponse.unavailable("storage_unavailable");
  }
};

const logSuccess = (logger: Logger, kind: string, expenseId: string) => {
  logger.info({ kind, expenseId });
};

const handleCreate = async (
  dependencies: Dependencies,
  command: ParsedCreateCommand,
) => {
  const existing = await loadExpense(dependencies.repository, command.id);
  if ("status" in existing) {
    if (existing.status === 404) {
      const expense = Expense.create(command.id, command.ownerId, command.ownerEmail, command.description, command.amountCents);
      const saveFailure = await saveExpense(dependencies.repository, expense);
      if (saveFailure !== undefined) return saveFailure;
      logSuccess(dependencies.logger, "expense.created", expense.id);
      return success(201, ExpenseResponse.toBody(expense));
    }

    return existing;
  }

  return ErrorResponse.conflict("duplicate_id");
};

const handleSubmit = async (
  dependencies: Dependencies,
  command: ParsedSubmitCommand,
) => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) return loaded;
  const expense = loaded;

  if (!Expense.isDraft(expense)) return ErrorResponse.conflict("invalid_state");
  if (expense.ownerId !== command.actorId) return ErrorResponse.forbidden();

  const submitted = Expense.submit(expense);
  const saveFailure = await saveExpense(dependencies.repository, submitted);
  if (saveFailure !== undefined) return saveFailure;
  logSuccess(dependencies.logger, "expense.submitted", submitted.id);
  return success(200, ExpenseResponse.toBody(submitted));
};

const handleApprove = async (
  dependencies: Dependencies,
  command: ParsedApproveCommand,
) => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) return loaded;
  const expense = loaded;

  if (!Expense.isSubmitted(expense)) return ErrorResponse.conflict("invalid_state");
  if (expense.ownerId === command.actorId) return ErrorResponse.forbidden();

  const approved = Expense.approve(expense);
  const saveFailure = await saveExpense(dependencies.repository, approved);
  if (saveFailure !== undefined) return saveFailure;
  logSuccess(dependencies.logger, "expense.approved", approved.id);
  return success(200, ExpenseResponse.toBody(approved));
};

const handleReject = async (
  dependencies: Dependencies,
  command: ParsedRejectCommand,
) => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) return loaded;
  const expense = loaded;

  if (!Expense.isSubmitted(expense)) return ErrorResponse.conflict("invalid_state");
  if (expense.ownerId === command.actorId) return ErrorResponse.forbidden();

  const rejected = Expense.reject(expense, command.actorId, command.reason);
  const saveFailure = await saveExpense(dependencies.repository, rejected);
  if (saveFailure !== undefined) return saveFailure;
  logSuccess(dependencies.logger, "expense.rejected", rejected.id);
  return success(200, ExpenseResponse.toBody(rejected));
};

const handlePay = async (dependencies: Dependencies, command: ParsedPayCommand) => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) return loaded;
  const expense = loaded;

  if (Expense.isPaid(expense)) {
    return success(200, ExpenseResponse.toBody(expense));
  }

  if (!Expense.isApproved(expense)) return ErrorResponse.conflict("invalid_state");

  try {
    const payment = await dependencies.payment.charge({
      expenseId: expense.id,
      amountCents: expense.amountCents,
      email: expense.ownerEmail,
      idempotencyKey: expense.id,
    });

    if (payment.kind === "declined") {
      return ErrorResponse.paymentDeclined();
    }

    if (payment.receiptId.length === 0) {
      return ErrorResponse.unavailable("invalid_gateway_response");
    }

    const paid = Expense.pay(expense, payment.receiptId);
    const saveFailure = await saveExpense(dependencies.repository, paid);
    if (saveFailure !== undefined) return saveFailure;
    logSuccess(dependencies.logger, "expense.paid", paid.id);
    return success(200, ExpenseResponse.toBody(paid));
  } catch {
    return ErrorResponse.unavailable("gateway_unavailable");
  }
};

const handleGet = async (dependencies: Dependencies, command: ParsedGetCommand) => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) return loaded;
  return success(200, ExpenseResponse.toBody(loaded));
};

export const createExpenseService = (dependencies: Dependencies): ExpenseService => ({
  handle: async (command: unknown) => {
    const parsed = Command.parse(command);
    if (parsed === undefined) {
      return ErrorResponse.invalidCommand();
    }

    try {
      if (parsed.kind === "create") return await handleCreate(dependencies, parsed);
      if (parsed.kind === "submit") return await handleSubmit(dependencies, parsed);
      if (parsed.kind === "approve") return await handleApprove(dependencies, parsed);
      if (parsed.kind === "reject") return await handleReject(dependencies, parsed);
      if (parsed.kind === "pay") return await handlePay(dependencies, parsed);
      return await handleGet(dependencies, parsed);
    } catch {
      return ErrorResponse.unavailable("internal_error");
    }
  },
} as const);
