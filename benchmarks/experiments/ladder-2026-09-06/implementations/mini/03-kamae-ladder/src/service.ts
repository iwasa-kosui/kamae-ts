import { Command, parseCommand } from "./command";
import { Expense, ExpenseAction, ExpenseBody, ExpenseDiagnosticEvent, PaymentResult } from "./expense";

type Repository = Readonly<{
  get: (id: string) => Promise<unknown>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

type PaymentRequest = Readonly<{
  expenseId: string;
  amountCents: number;
  email: string;
  idempotencyKey: string;
}>;

type PaymentGateway = Readonly<{
  charge: (request: PaymentRequest) => Promise<PaymentResult>;
}>;

type Logger = Readonly<{
  info: (event: ExpenseDiagnosticEvent) => void;
}>;

export type Dependencies = Readonly<{
  repository: Repository;
  payment: PaymentGateway;
  logger: Logger;
}>;

type SuccessStatus = 200 | 201;
type FailureStatus = 400 | 403 | 404 | 409 | 422 | 500;

export type ServiceResponse =
  | Readonly<{
      status: SuccessStatus;
      body: ExpenseBody;
    }>
  | Readonly<{
      status: FailureStatus;
      body: Readonly<{ code: string }>;
    }>;

type FailureCode =
  | "invalid_command"
  | "forbidden"
  | "expense_not_found"
  | "conflict"
  | "service_unavailable"
  | "invalid_gateway_response";

function success(status: SuccessStatus, body: ExpenseBody): ServiceResponse {
  return { status, body };
}

function failure(status: FailureStatus, code: string): ServiceResponse {
  return { status, body: { code } };
}

function invalidCommand(): ServiceResponse {
  return failure(400, "invalid_command");
}

function forbidden(): ServiceResponse {
  return failure(403, "forbidden");
}

function notFound(): ServiceResponse {
  return failure(404, "expense_not_found");
}

function conflict(code: string = "conflict"): ServiceResponse {
  return failure(409, code);
}

function paymentDeclined(): ServiceResponse {
  return { status: 422, body: { code: "payment_declined" } };
}

function serviceUnavailable(code: FailureCode = "service_unavailable"): ServiceResponse {
  return failure(500, code);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function isNonEmptyReceiptId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function logSuccess(logger: Logger, expenseId: string, action: ExpenseAction): void {
  logger.info({
    kind: "expense_action",
    expenseId,
    action,
  });
}

type LoadedExpense = Exclude<ReturnType<typeof Expense.fromStored>, undefined>;

async function loadExpense(repository: Repository, id: string): Promise<ServiceResponse | { expense: LoadedExpense }> {
  try {
    const raw = await repository.get(id);
    if (raw === undefined) {
      return notFound();
    }

    const expense = Expense.fromStored(raw);
    if (expense === undefined) {
      return serviceUnavailable();
    }

    return { expense };
  } catch {
    return serviceUnavailable();
  }
}

function toSuccessResponse(expense: LoadedExpense, status: SuccessStatus): ServiceResponse {
  return success(status, Expense.toBody(expense));
}

function isDraft(expense: LoadedExpense): expense is Extract<LoadedExpense, { kind: "draft" }> {
  return expense.kind === "draft";
}

function isSubmitted(expense: LoadedExpense): expense is Extract<LoadedExpense, { kind: "submitted" }> {
  return expense.kind === "submitted";
}

function isApproved(expense: LoadedExpense): expense is Extract<LoadedExpense, { kind: "approved" }> {
  return expense.kind === "approved";
}

function isPaid(expense: LoadedExpense): expense is Extract<LoadedExpense, { kind: "paid" }> {
  return expense.kind === "paid";
}

async function handleCreate(dependencies: Dependencies, command: Extract<Command, { op: "create" }>): Promise<ServiceResponse> {
  try {
    const existing = await dependencies.repository.get(command.id);
    if (existing !== undefined) {
      return conflict();
    }
  } catch {
    return serviceUnavailable();
  }

  const draft = Expense.createDraft({
    id: command.id,
    ownerId: command.ownerId,
    ownerEmail: command.ownerEmail,
    description: command.description,
    amountCents: command.amountCents,
  });

  try {
    await dependencies.repository.save(draft.id, Expense.toStored(draft));
  } catch {
    return serviceUnavailable();
  }

  logSuccess(dependencies.logger, draft.id, "create");
  return success(201, Expense.toBody(draft));
}

async function handleSubmit(dependencies: Dependencies, command: Extract<Command, { op: "submit" }>): Promise<ServiceResponse> {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) {
    return loaded;
  }

  const expense = loaded.expense;
  if (!isDraft(expense)) {
    return conflict();
  }

  if (expense.ownerId !== command.actorId) {
    return forbidden();
  }

  const submitted = Expense.submit(expense, command.actorId);
  try {
    await dependencies.repository.save(submitted.id, Expense.toStored(submitted));
  } catch {
    return serviceUnavailable();
  }

  logSuccess(dependencies.logger, submitted.id, "submit");
  return toSuccessResponse(submitted, 200);
}

async function handleApprove(dependencies: Dependencies, command: Extract<Command, { op: "approve" }>): Promise<ServiceResponse> {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) {
    return loaded;
  }

  const expense = loaded.expense;
  if (!isSubmitted(expense)) {
    return conflict();
  }

  if (expense.ownerId === command.actorId) {
    return forbidden();
  }

  const approved = Expense.approve(expense, command.actorId);
  try {
    await dependencies.repository.save(approved.id, Expense.toStored(approved));
  } catch {
    return serviceUnavailable();
  }

  logSuccess(dependencies.logger, approved.id, "approve");
  return toSuccessResponse(approved, 200);
}

async function handleReject(dependencies: Dependencies, command: Extract<Command, { op: "reject" }>): Promise<ServiceResponse> {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) {
    return loaded;
  }

  const expense = loaded.expense;
  if (!isSubmitted(expense)) {
    return conflict();
  }

  if (expense.ownerId === command.actorId) {
    return forbidden();
  }

  const rejected = Expense.reject(expense, command.actorId, command.reason);
  try {
    await dependencies.repository.save(rejected.id, Expense.toStored(rejected));
  } catch {
    return serviceUnavailable();
  }

  logSuccess(dependencies.logger, rejected.id, "reject");
  return toSuccessResponse(rejected, 200);
}

async function handlePay(dependencies: Dependencies, command: Extract<Command, { op: "pay" }>): Promise<ServiceResponse> {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) {
    return loaded;
  }

  const expense = loaded.expense;
  if (isPaid(expense)) {
    return toSuccessResponse(expense, 200);
  }

  if (!isApproved(expense)) {
    return conflict();
  }

  let paymentResult: PaymentResult;
  try {
    paymentResult = await dependencies.payment.charge({
      expenseId: expense.id,
      amountCents: expense.amountCents,
      email: expense.ownerEmail,
      idempotencyKey: expense.id,
    });
  } catch {
    return serviceUnavailable();
  }

  if (paymentResult.kind === "declined") {
    return paymentDeclined();
  }

  if (!isNonEmptyReceiptId(paymentResult.receiptId)) {
    return serviceUnavailable("invalid_gateway_response");
  }

  const paid = Expense.pay(expense, paymentResult.receiptId);
  try {
    await dependencies.repository.save(paid.id, Expense.toStored(paid));
  } catch {
    return serviceUnavailable();
  }

  logSuccess(dependencies.logger, paid.id, "pay");
  return toSuccessResponse(paid, 200);
}

async function handleGet(dependencies: Dependencies, command: Extract<Command, { op: "get" }>): Promise<ServiceResponse> {
  const loaded = await loadExpense(dependencies.repository, command.id);
  if ("status" in loaded) {
    return loaded;
  }

  return toSuccessResponse(loaded.expense, 200);
}

export function createExpenseService(dependencies: Dependencies) {
  return {
    async handle(command: unknown): Promise<ServiceResponse> {
      const parsed = parseCommand(command);
      if (!parsed.ok) {
        return invalidCommand();
      }

      switch (parsed.value.op) {
        case "create":
          return handleCreate(dependencies, parsed.value);
        case "submit":
          return handleSubmit(dependencies, parsed.value);
        case "approve":
          return handleApprove(dependencies, parsed.value);
        case "reject":
          return handleReject(dependencies, parsed.value);
        case "pay":
          return handlePay(dependencies, parsed.value);
        case "get":
          return handleGet(dependencies, parsed.value);
        default:
          return assertNever(parsed.value);
      }
    },
  };
}
