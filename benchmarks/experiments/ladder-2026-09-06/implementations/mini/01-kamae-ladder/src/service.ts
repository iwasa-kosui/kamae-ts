import {
  Expense,
  assertNever,
  isApprovedExpense,
  isDraftExpense,
  isPaidExpense,
  isSubmittedExpense,
  parseExpense,
} from "./expense";
import {
  type Command,
  type ParseResult as CommandParseResult,
  parseCommand,
} from "./validation";
import type { EmailAddress, EmployeeId, ExpenseId } from "./validation";
import { Expense as ExpenseModel } from "./expense";

type Repository = Readonly<{
  get: (id: ExpenseId) => Promise<unknown | undefined>;
  save: (id: ExpenseId, value: unknown) => Promise<void>;
}>;

type Payment = Readonly<{
  charge: (input: {
    expenseId: ExpenseId;
    amountCents: number;
    email: EmailAddress;
    idempotencyKey: ExpenseId;
  }) => Promise<{ kind: "paid"; receiptId: string } | { kind: "declined" }>;
}>;

type Logger = Readonly<{
  info: (event: unknown) => void;
}>;

type Dependencies = Readonly<{
  repository: Repository;
  payment: Payment;
  logger: Logger;
}>;

type Response = Readonly<{
  status: number;
  body: Record<string, unknown>;
}>;

type InternalError = Readonly<{
  status: 500;
  body: Readonly<{ code: "internal_error" }>;
}>;

const internalError = (): InternalError => ({
  status: 500,
  body: { code: "internal_error" },
});

const invalidCommand = (): Response => ({
  status: 400,
  body: { code: "invalid_command" },
});

const forbidden = (): Response => ({
  status: 403,
  body: { code: "forbidden" },
});

const notFound = (): Response => ({
  status: 404,
  body: { code: "not_found" },
});

const conflict = (): Response => ({
  status: 409,
  body: { code: "conflict" },
});

const paymentDeclined = (): Response => ({
  status: 422,
  body: { code: "payment_declined" },
});

const ok = (expense: Expense): Response => ({
  status: 200,
  body: ExpenseModel.toBody(expense),
});

const created = (expense: Expense): Response => ({
  status: 201,
  body: ExpenseModel.toBody(expense),
});

const loadExpense = async (
  repository: Repository,
  id: ExpenseId,
): Promise<{ kind: "missing" } | { kind: "invalid" } | { kind: "found"; expense: Expense }> => {
  try {
    const raw = await repository.get(id);
    if (raw === undefined) return { kind: "missing" };
    const parsed = parseExpense(raw);
    return parsed.ok ? { kind: "found", expense: parsed.value } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
};

const saveExpense = async (repository: Repository, expense: Expense): Promise<boolean> => {
  try {
    await repository.save(expense.id, expense);
    return true;
  } catch {
    return false;
  }
};

const logEvent = (logger: Logger, event: unknown): boolean => {
  try {
    logger.info(event);
    return true;
  } catch {
    return false;
  }
};

const createHandler =
  (dependencies: Dependencies) =>
  async (rawCommand: unknown): Promise<Response> => {
    const parsed = parseCommand(rawCommand);
    if (!parsed.ok) return invalidCommand();

    const command = parsed.value;

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
      default:
        return assertNever(command);
    }
  };

const handleCreate = async (dependencies: Dependencies, command: Extract<Command, { op: "create" }>): Promise<Response> => {
  try {
    const existing = await dependencies.repository.get(command.id);
    if (existing !== undefined) {
      const parsed = parseExpense(existing);
      return parsed.ok ? conflict() : internalError();
    }

    const expense = ExpenseModel.create(command);
    if (!(await saveExpense(dependencies.repository, expense))) return internalError();
    if (!logEvent(dependencies.logger, ExpenseModel.event.created(expense.id))) return internalError();
    return created(expense);
  } catch {
    return internalError();
  }
};

const handleSubmit = async (dependencies: Dependencies, command: Extract<Command, { op: "submit" }>): Promise<Response> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "missing") return notFound();
  if (loaded.kind === "invalid") return internalError();

  const expense = loaded.expense;
  if (!isDraftExpense(expense)) return conflict();
  if (expense.ownerId !== command.actorId) return forbidden();

  const submitted = ExpenseModel.submit(expense);
  if (!(await saveExpense(dependencies.repository, submitted))) return internalError();
  if (!logEvent(dependencies.logger, ExpenseModel.event.submitted(submitted.id))) return internalError();
  return ok(submitted);
};

const handleApprove = async (dependencies: Dependencies, command: Extract<Command, { op: "approve" }>): Promise<Response> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "missing") return notFound();
  if (loaded.kind === "invalid") return internalError();

  const expense = loaded.expense;
  if (!isSubmittedExpense(expense)) return conflict();
  if (expense.ownerId === command.actorId) return forbidden();

  const approved = ExpenseModel.approve(expense, command.actorId);
  if (!(await saveExpense(dependencies.repository, approved))) return internalError();
  if (!logEvent(dependencies.logger, ExpenseModel.event.approved(approved.id))) return internalError();
  return ok(approved);
};

const handleReject = async (dependencies: Dependencies, command: Extract<Command, { op: "reject" }>): Promise<Response> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "missing") return notFound();
  if (loaded.kind === "invalid") return internalError();

  const expense = loaded.expense;
  if (!isSubmittedExpense(expense)) return conflict();
  if (expense.ownerId === command.actorId) return forbidden();

  const rejected = ExpenseModel.reject(expense, command.actorId, command.reason);
  if (!(await saveExpense(dependencies.repository, rejected))) return internalError();
  if (!logEvent(dependencies.logger, ExpenseModel.event.rejected(rejected.id))) return internalError();
  return ok(rejected);
};

const handlePay = async (dependencies: Dependencies, command: Extract<Command, { op: "pay" }>): Promise<Response> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "missing") return notFound();
  if (loaded.kind === "invalid") return internalError();

  const expense = loaded.expense;
  if (isPaidExpense(expense)) return ok(expense);
  if (!isApprovedExpense(expense)) return conflict();

  try {
    const outcome = await dependencies.payment.charge({
      expenseId: expense.id,
      amountCents: expense.amountCents,
      email: expense.ownerEmail,
      idempotencyKey: expense.id,
    });

    if (outcome.kind === "declined") return paymentDeclined();
    if (!("receiptId" in outcome) || !outcome.receiptId.trim()) return internalError();

    const paid = ExpenseModel.pay(expense, outcome.receiptId);
    if (!(await saveExpense(dependencies.repository, paid))) return internalError();
    if (!logEvent(dependencies.logger, ExpenseModel.event.paid(paid.id))) return internalError();
    return ok(paid);
  } catch {
    return internalError();
  }
};

const handleGet = async (dependencies: Dependencies, command: Extract<Command, { op: "get" }>): Promise<Response> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "missing") return notFound();
  if (loaded.kind === "invalid") return internalError();
  return ok(loaded.expense);
};

export const createExpenseService = (dependencies: Dependencies): Readonly<{
  handle: (command: unknown) => Promise<Response>;
}> => ({
  handle: createHandler(dependencies),
});
