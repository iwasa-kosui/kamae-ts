import { Command, type Command as CommandType } from "./commands";
import { Expense, type Expense as ExpenseType } from "./expense";
import { Record } from "./record";
import { Result } from "./result";

type Repository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

type PaymentChargeResult = Readonly<{ kind: "paid"; receiptId: string }> | Readonly<{ kind: "declined" }>;

type Payment = Readonly<{
  charge: (request: {
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }) => Promise<PaymentChargeResult>;
}>;

type Logger = Readonly<{
  info: (event: Readonly<{ kind: string; expenseId: string; action: string }>) => void;
}>;

export type CreateExpenseServiceDependencies = Readonly<{
  repository: Repository;
  payment: Payment;
  logger: Logger;
}>;

type ServiceErrorCode = "invalid_command" | "forbidden" | "missing_expense" | "conflict" | "payment_declined" | "unavailable";

type ServiceError = Readonly<{
  status: 400 | 403 | 404 | 409 | 422 | 500;
  code: ServiceErrorCode;
}>;

type PublicExpense = ReturnType<typeof Expense.toView>;

type ServiceResponse = Readonly<{
  status: 200 | 201;
  body: PublicExpense;
}> | Readonly<{
  status: 400 | 403 | 404 | 409 | 422 | 500;
  body: { code: string };
}>;

const error = (status: ServiceError["status"], code: ServiceErrorCode): ServiceError => ({ status, code });

const toResponse = (status: 200 | 201, expense: ExpenseType) => ({
  status,
  body: Expense.toView(expense),
} as const);

const toErrorResponse = (failure: ServiceError) => ({
  status: failure.status,
  body: { code: failure.code },
} as const);

const notFound = () => error(404, "missing_expense");
const conflict = () => error(409, "conflict");
const forbidden = () => error(403, "forbidden");
const invalid = () => error(400, "invalid_command");
const unavailable = () => error(500, "unavailable");
const paymentDeclined = () => error(422, "payment_declined");

const loadExpense = async (
  repository: Repository,
  id: string,
): Promise<ExpenseType | ServiceError> => {
  try {
    const raw = await repository.get(id);
    if (raw === undefined) {
      return notFound();
    }

    const parsed = Record.parse(raw);
    return Result.isOk(parsed) ? parsed.value : unavailable();
  } catch {
    return unavailable();
  }
};

const saveExpense = async (
  repository: Repository,
  expense: ExpenseType,
): Promise<ServiceError | undefined> => {
  try {
    await repository.save(expense.id, Record.serialize(expense));
    return undefined;
  } catch {
    return unavailable();
  }
};

const logAction = (logger: Logger, expense: ExpenseType, action: string): void => {
  logger.info({
    kind: "expense_event",
    expenseId: expense.id,
    action,
  });
};

const create = async (
  deps: CreateExpenseServiceDependencies,
  command: Extract<CommandType, { op: "create" }>,
): Promise<ServiceResponse> => {
  try {
    const existing = await deps.repository.get(command.id);
    if (existing !== undefined) {
      const parsed = Record.parse(existing);
      if (Result.isErr(parsed)) {
        return toErrorResponse(unavailable());
      }

      return toErrorResponse(conflict());
    }

    const expense = Expense.create(command.id, command.ownerId, command.ownerEmail, command.description, command.amountCents);
    const saved = await saveExpense(deps.repository, expense);
    if (saved) {
      return toErrorResponse(saved);
    }

    logAction(deps.logger, expense, "created");
    return toResponse(201, expense);
  } catch {
    return toErrorResponse(unavailable());
  }
};

const submit = async (
  deps: CreateExpenseServiceDependencies,
  command: Extract<CommandType, { op: "submit" }>,
): Promise<ServiceResponse> => {
  const loaded = await loadExpense(deps.repository, command.id);
  if ("status" in loaded) {
    return toErrorResponse(loaded);
  }

  if (loaded.ownerId !== command.actorId) {
    return toErrorResponse(forbidden());
  }

  if (!Expense.isDraft(loaded)) {
    return toErrorResponse(conflict());
  }

  const next = Expense.submit(loaded);
  const saved = await saveExpense(deps.repository, next);
  if (saved) {
    return toErrorResponse(saved);
  }

  logAction(deps.logger, next, "submitted");
  return toResponse(200, next);
};

const approve = async (
  deps: CreateExpenseServiceDependencies,
  command: Extract<CommandType, { op: "approve" }>,
): Promise<ServiceResponse> => {
  const loaded = await loadExpense(deps.repository, command.id);
  if ("status" in loaded) {
    return toErrorResponse(loaded);
  }

  if (loaded.ownerId === command.actorId) {
    return toErrorResponse(forbidden());
  }

  if (!Expense.isSubmitted(loaded)) {
    return toErrorResponse(conflict());
  }

  const next = Expense.approve(loaded, command.actorId);
  const saved = await saveExpense(deps.repository, next);
  if (saved) {
    return toErrorResponse(saved);
  }

  logAction(deps.logger, next, "approved");
  return toResponse(200, next);
};

const reject = async (
  deps: CreateExpenseServiceDependencies,
  command: Extract<CommandType, { op: "reject" }>,
): Promise<ServiceResponse> => {
  const loaded = await loadExpense(deps.repository, command.id);
  if ("status" in loaded) {
    return toErrorResponse(loaded);
  }

  if (loaded.ownerId === command.actorId) {
    return toErrorResponse(forbidden());
  }

  if (!Expense.isSubmitted(loaded)) {
    return toErrorResponse(conflict());
  }

  const next = Expense.reject(loaded, command.actorId, command.reason);
  const saved = await saveExpense(deps.repository, next);
  if (saved) {
    return toErrorResponse(saved);
  }

  logAction(deps.logger, next, "rejected");
  return toResponse(200, next);
};

const pay = async (
  deps: CreateExpenseServiceDependencies,
  command: Extract<CommandType, { op: "pay" }>,
): Promise<ServiceResponse> => {
  const loaded = await loadExpense(deps.repository, command.id);
  if ("status" in loaded) {
    return toErrorResponse(loaded);
  }

  if (Expense.isPaid(loaded)) {
    return toResponse(200, loaded);
  }

  if (!Expense.isApproved(loaded)) {
    return toErrorResponse(conflict());
  }

  let chargeResult: PaymentChargeResult;
  try {
    chargeResult = await deps.payment.charge({
      expenseId: loaded.id,
      amountCents: loaded.amountCents,
      email: loaded.ownerEmail,
      idempotencyKey: loaded.id,
    });
  } catch {
    return toErrorResponse(unavailable());
  }

  if (chargeResult.kind === "declined") {
    return toErrorResponse(paymentDeclined());
  }

  if (typeof chargeResult.receiptId !== "string" || chargeResult.receiptId.length === 0) {
    return toErrorResponse(unavailable());
  }

  const next = Expense.markPaid(loaded, chargeResult.receiptId);
  const saved = await saveExpense(deps.repository, next);
  if (saved) {
    return toErrorResponse(saved);
  }

  logAction(deps.logger, next, "paid");
  return toResponse(200, next);
};

const get = async (
  deps: CreateExpenseServiceDependencies,
  command: Extract<CommandType, { op: "get" }>,
): Promise<ServiceResponse> => {
  const loaded = await loadExpense(deps.repository, command.id);
  if ("status" in loaded) {
    return toErrorResponse(loaded);
  }

  return toResponse(200, loaded);
};

export const createExpenseService = (dependencies: CreateExpenseServiceDependencies) => ({
  handle: async (rawCommand: unknown): Promise<ServiceResponse> => {
    try {
      const parsed = Command.parse(rawCommand);
      if (Result.isErr(parsed)) {
        return toErrorResponse(invalid());
      }

      if (parsed.value.op === "create") return create(dependencies, parsed.value);
      if (parsed.value.op === "submit") return submit(dependencies, parsed.value);
      if (parsed.value.op === "approve") return approve(dependencies, parsed.value);
      if (parsed.value.op === "reject") return reject(dependencies, parsed.value);
      if (parsed.value.op === "pay") return pay(dependencies, parsed.value);
      return get(dependencies, parsed.value);
    } catch {
      return toErrorResponse(unavailable());
    }
  },
}) as const;
