import type { AmountCents as AmountCentsType } from "./amount-cents";
import type { EmailAddress as EmailAddressType } from "./email-address";
import { Expense, type ExpenseBody, type ExpenseEvent, type ExpenseRecord, type ExpenseTransitionError } from "./expense";
import { parseCommand, type Command } from "./command";
import type { EmployeeId as EmployeeIdType } from "./employee-id";
import type { ExpenseId as ExpenseIdType } from "./expense-id";
import { isRecord } from "./validation";

export type ExpenseResponse = Readonly<{
  status: number;
  body: ExpenseBody | Readonly<{ code: string }>;
}>;

type Repository = Readonly<{
  get: (id: ExpenseIdType) => Promise<unknown | undefined>;
  save: (id: ExpenseIdType, value: ExpenseRecord) => Promise<void>;
}>;

type PaymentResult = Readonly<{ kind: "paid"; receiptId: string }> | Readonly<{ kind: "declined" }>;

type Payment = Readonly<{
  charge: (args: Readonly<{
    expenseId: ExpenseIdType;
    amountCents: AmountCentsType;
    email: EmailAddressType;
    idempotencyKey: ExpenseIdType;
  }>) => Promise<unknown>;
}>;

type Logger = Readonly<{
  info: (event: ExpenseEvent) => void;
}>;

export type ExpenseServiceDependencies = Readonly<{
  repository: Repository;
  payment: Payment;
  logger: Logger;
}>;

type FailureCode =
  | "invalid_command"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payment_declined"
  | "storage_unavailable"
  | "gateway_unavailable"
  | "invalid_gateway_response";

const failure = (status: number, code: FailureCode): ExpenseResponse => ({
  status,
  body: { code },
});

const success = (status: number, body: ExpenseBody): ExpenseResponse => ({
  status,
  body,
});

const parseStoredExpense = (raw: unknown): ExpenseRecord | undefined => {
  const parsed = Expense.parseRecord(raw);
  return parsed.kind === "ok" ? parsed.value : undefined;
};

const loadExpense = async (
  repository: Repository,
  id: ExpenseIdType,
): Promise<Readonly<
  | { kind: "missing" }
  | { kind: "found"; expense: ExpenseRecord }
  | { kind: "error"; code: FailureCode }
>> => {
  try {
    const stored = await repository.get(id);
    if (stored === undefined) {
      return { kind: "missing" };
    }

    const expense = parseStoredExpense(stored);
    if (expense === undefined) {
      return { kind: "error", code: "storage_unavailable" };
    }

    return { kind: "found", expense };
  } catch {
    return { kind: "error", code: "storage_unavailable" };
  }
};

const saveExpense = async (
  repository: Repository,
  expense: ExpenseRecord,
): Promise<Readonly<{ kind: "ok" } | { kind: "error"; code: FailureCode }>> => {
  try {
    await repository.save(expense.id, expense);
    return { kind: "ok" };
  } catch {
    return { kind: "error", code: "storage_unavailable" };
  }
};

const logSuccess = (logger: Logger, event: ExpenseEvent): void => {
  try {
    logger.info(event);
  } catch {
    // Best-effort diagnostics; workflow outcome is already determined.
  }
};

const mapTransitionError = (error: ExpenseTransitionError): ExpenseResponse =>
  error.kind === "forbidden"
    ? failure(403, "forbidden")
    : failure(409, "conflict");

const applyCreate = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<Command, { op: "create" }>,
): Promise<ExpenseResponse> => {
  const existing = await loadExpense(dependencies.repository, command.id);
  if (existing.kind === "error") {
    return failure(500, existing.code);
  }

  if (existing.kind === "found") {
    return failure(409, "conflict");
  }

  const expense: ExpenseRecord = {
    kind: "Expense",
    id: command.id,
    ownerId: command.ownerId,
    ownerEmail: command.ownerEmail,
    description: command.description,
    amountCents: command.amountCents,
    state: { kind: "draft" },
  };

  const saved = await saveExpense(dependencies.repository, expense);
  if (saved.kind === "error") {
    return failure(500, saved.code);
  }

  logSuccess(dependencies.logger, Expense.toLogEvent("created", expense.id));
  return success(201, Expense.toBody(expense));
};

const applyExistingTransition = async (
  dependencies: ExpenseServiceDependencies,
  id: ExpenseIdType,
  transition: (expense: ExpenseRecord) => ReturnType<typeof Expense.submit>,
  action: ExpenseEvent["action"],
): Promise<ExpenseResponse> => {
  const loaded = await loadExpense(dependencies.repository, id);
  if (loaded.kind === "error") {
    return failure(500, loaded.code);
  }

  if (loaded.kind === "missing") {
    return failure(404, "not_found");
  }

  const next = transition(loaded.expense);
  if (next.kind === "err") {
    return mapTransitionError(next.error);
  }

  const saved = await saveExpense(dependencies.repository, next.value);
  if (saved.kind === "error") {
    return failure(500, saved.code);
  }

  logSuccess(dependencies.logger, Expense.toLogEvent(action, next.value.id));
  return success(200, Expense.toBody(next.value));
};

const applySubmit = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<Command, { op: "submit" }>,
): Promise<ExpenseResponse> =>
  applyExistingTransition(
    dependencies,
    command.id,
    (expense) => Expense.submit(expense, command.actorId),
    "submitted",
  );

const applyApprove = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<Command, { op: "approve" }>,
): Promise<ExpenseResponse> =>
  applyExistingTransition(
    dependencies,
    command.id,
    (expense) => Expense.approve(expense, command.actorId),
    "approved",
  );

const applyReject = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<Command, { op: "reject" }>,
): Promise<ExpenseResponse> =>
  applyExistingTransition(
    dependencies,
    command.id,
    (expense) => Expense.reject(expense, command.actorId, command.reason),
    "rejected",
  );

const parseGatewayResponse = (raw: unknown): PaymentResult | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }

  const kind = raw.kind;
  if (kind === "declined") {
    return { kind: "declined" };
  }

  if (kind === "paid") {
    const receiptId = raw.receiptId;
    if (typeof receiptId === "string" && receiptId.trim().length > 0) {
      return { kind: "paid", receiptId };
    }
  }

  return undefined;
};

const applyPay = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<Command, { op: "pay" }>,
): Promise<ExpenseResponse> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "error") {
    return failure(500, loaded.code);
  }

  if (loaded.kind === "missing") {
    return failure(404, "not_found");
  }

  if (loaded.expense.state.kind === "paid") {
    return success(200, Expense.toBody(loaded.expense));
  }

  if (loaded.expense.state.kind !== "approved") {
    return failure(409, "conflict");
  }

  let charged: unknown;
  try {
    charged = await dependencies.payment.charge({
      expenseId: loaded.expense.id,
      amountCents: loaded.expense.amountCents,
      email: loaded.expense.ownerEmail,
      idempotencyKey: loaded.expense.id,
    });
  } catch {
    return failure(500, "gateway_unavailable");
  }

  const payment = parseGatewayResponse(charged);
  if (payment === undefined) {
    return failure(500, "invalid_gateway_response");
  }

  if (payment.kind === "declined") {
    return failure(422, "payment_declined");
  }

  const paid = Expense.pay(loaded.expense, payment.receiptId);
  if (paid.kind === "err") {
    return failure(409, "conflict");
  }

  const saved = await saveExpense(dependencies.repository, paid.value);
  if (saved.kind === "error") {
    return failure(500, saved.code);
  }

  logSuccess(dependencies.logger, Expense.toLogEvent("paid", paid.value.id));
  return success(200, Expense.toBody(paid.value));
};

const applyGet = async (
  dependencies: ExpenseServiceDependencies,
  command: Extract<Command, { op: "get" }>,
): Promise<ExpenseResponse> => {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if (loaded.kind === "error") {
    return failure(500, loaded.code);
  }

  if (loaded.kind === "missing") {
    return failure(404, "not_found");
  }

  return success(200, Expense.toBody(loaded.expense));
};

export const createExpenseService = (dependencies: ExpenseServiceDependencies) => ({
  handle: async (rawCommand: unknown): Promise<ExpenseResponse> => {
    const parsed = parseCommand(rawCommand);
    if (parsed.kind === "err") {
      return failure(400, "invalid_command");
    }

    switch (parsed.value.op) {
      case "create":
        return applyCreate(dependencies, parsed.value);
      case "submit":
        return applySubmit(dependencies, parsed.value);
      case "approve":
        return applyApprove(dependencies, parsed.value);
      case "reject":
        return applyReject(dependencies, parsed.value);
      case "pay":
        return applyPay(dependencies, parsed.value);
      case "get":
        return applyGet(dependencies, parsed.value);
      default: {
        const exhaustive: never = parsed.value;
        return exhaustive;
      }
    }
  },
} as const);
