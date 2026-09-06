import { Command } from "./command";
import { EmailAddress } from "./email-address";
import { EmployeeId } from "./employee-id";
import { Expense } from "./expense";
import { ExpenseId } from "./expense-id";
import { ExpenseLogEvent } from "./logger-event";
import { PublicExpense } from "./public-expense";
import { ReceiptId } from "./receipt-id";
import { assertNever } from "./assert-never";

type Repository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
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
  info: (event: Readonly<{ kind: "expense_event"; expenseId: string; action: string }>) => void;
}>;

type Dependencies = Readonly<{
  repository: Repository;
  payment: Payment;
  logger: Logger;
}>;

type ResponseBody = PublicExpense | Readonly<{ code: string }>;

type Response = Readonly<{
  status: number;
  body: ResponseBody;
}>;

const invalid = (status: number, code: string): Response => ({
  status,
  body: {
    code,
  },
});

const unavailable = (): Response => invalid(500, "unavailable");

const parseStoredExpense = (raw: unknown): Expense | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const id = ExpenseId.parse(Reflect.get(raw, "id"));
  const ownerId = EmployeeId.parse(Reflect.get(raw, "ownerId"));
  const ownerEmail = EmailAddress.parse(Reflect.get(raw, "ownerEmail"));
  const descriptionValue = Reflect.get(raw, "description");
  const amountValue = Reflect.get(raw, "amountCents");
  const description = typeof descriptionValue === "string" && descriptionValue.trim().length > 0 ? descriptionValue : undefined;
  const amountCents =
    typeof amountValue === "number" && Number.isInteger(amountValue) && amountValue >= 1 && amountValue <= 1_000_000
      ? amountValue
      : undefined;

  if (
    id === undefined ||
    ownerId === undefined ||
    ownerEmail === undefined ||
    description === undefined ||
    amountCents === undefined
  ) {
    return undefined;
  }

  switch (Reflect.get(raw, "kind")) {
    case "draft":
      return {
        kind: "draft",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
      };
    case "submitted":
      return {
        kind: "submitted",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
      };
    case "approved": {
      const approvedReviewer = EmployeeId.parse(Reflect.get(raw, "reviewerId"));
      return approvedReviewer === undefined
        ? undefined
        : {
            kind: "approved",
            id,
            ownerId,
            ownerEmail,
            description,
            amountCents,
            reviewerId: approvedReviewer,
          };
    }
    case "rejected": {
      const rejectedReviewer = EmployeeId.parse(Reflect.get(raw, "reviewerId"));
      const rejectedReason = Reflect.get(raw, "reason");
      return rejectedReviewer === undefined || typeof rejectedReason !== "string" || rejectedReason.trim().length === 0
        ? undefined
        : {
            kind: "rejected",
            id,
            ownerId,
            ownerEmail,
            description,
            amountCents,
            reviewerId: rejectedReviewer,
            reason: rejectedReason,
          };
    }
    case "paid": {
      const paidReviewer = EmployeeId.parse(Reflect.get(raw, "reviewerId"));
      const receiptId = ReceiptId.parse(Reflect.get(raw, "receiptId"));
      return paidReviewer === undefined || receiptId === undefined
        ? undefined
        : {
            kind: "paid",
            id,
            ownerId,
            ownerEmail,
            description,
            amountCents,
            reviewerId: paidReviewer,
            receiptId,
          };
    }
    default:
      return undefined;
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

const loadExpense = async (repository: Repository, id: string): Promise<Expense | undefined | "invalid"> => {
  try {
    const raw = await repository.get(id);
    if (raw === undefined) {
      return undefined;
    }

    const expense = parseStoredExpense(raw);
    return expense === undefined ? "invalid" : expense;
  } catch {
    return "invalid";
  }
};

const log = (logger: Logger, event: ExpenseLogEvent): void => {
  logger.info(event);
};

const handleCreate = async (deps: Dependencies, id: string, ownerId: string, ownerEmail: string, description: string, amountCents: number): Promise<Response> => {
  const existing = await loadExpense(deps.repository, id);
  if (existing === "invalid") {
    return unavailable();
  }

  if (existing !== undefined) {
    return invalid(409, "conflict");
  }

  const expense = Expense.create({
    id: ExpenseId.of(id),
    ownerId: EmployeeId.of(ownerId),
    ownerEmail: EmailAddress.of(ownerEmail),
    description,
    amountCents,
  });

  if ((await saveExpense(deps.repository, expense)) === false) {
    return unavailable();
  }

  try {
    log(deps.logger, ExpenseLogEvent.created(expense.id));
  } catch {
    return unavailable();
  }

  return {
    status: 201,
    body: PublicExpense.fromExpense(expense),
  };
};

const handleSubmit = async (deps: Dependencies, id: string, actorId: string): Promise<Response> => {
  const current = await loadExpense(deps.repository, id);
  if (current === "invalid") {
    return unavailable();
  }
  if (current === undefined) {
    return invalid(404, "missing_expense");
  }
  if (!Expense.isDraft(current)) {
    return invalid(409, "conflict");
  }
  if (current.ownerId !== EmployeeId.of(actorId)) {
    return invalid(403, "forbidden");
  }

  const expense = Expense.submit(current);
  if ((await saveExpense(deps.repository, expense)) === false) {
    return unavailable();
  }

  try {
    log(deps.logger, ExpenseLogEvent.submitted(expense.id));
  } catch {
    return unavailable();
  }

  return {
    status: 200,
    body: PublicExpense.fromExpense(expense),
  };
};

const handleApprove = async (deps: Dependencies, id: string, actorId: string): Promise<Response> => {
  const current = await loadExpense(deps.repository, id);
  if (current === "invalid") {
    return unavailable();
  }
  if (current === undefined) {
    return invalid(404, "missing_expense");
  }
  if (!Expense.isSubmitted(current)) {
    return invalid(409, "conflict");
  }
  if (current.ownerId === EmployeeId.of(actorId)) {
    return invalid(403, "forbidden");
  }

  const expense = Expense.approve(current, EmployeeId.of(actorId));
  if ((await saveExpense(deps.repository, expense)) === false) {
    return unavailable();
  }

  try {
    log(deps.logger, ExpenseLogEvent.approved(expense.id));
  } catch {
    return unavailable();
  }

  return {
    status: 200,
    body: PublicExpense.fromExpense(expense),
  };
};

const handleReject = async (deps: Dependencies, id: string, actorId: string, reason: string): Promise<Response> => {
  const current = await loadExpense(deps.repository, id);
  if (current === "invalid") {
    return unavailable();
  }
  if (current === undefined) {
    return invalid(404, "missing_expense");
  }
  if (!Expense.isSubmitted(current)) {
    return invalid(409, "conflict");
  }
  if (current.ownerId === EmployeeId.of(actorId)) {
    return invalid(403, "forbidden");
  }

  const expense = Expense.reject(current, EmployeeId.of(actorId), reason);
  if ((await saveExpense(deps.repository, expense)) === false) {
    return unavailable();
  }

  try {
    log(deps.logger, ExpenseLogEvent.rejected(expense.id));
  } catch {
    return unavailable();
  }

  return {
    status: 200,
    body: PublicExpense.fromExpense(expense),
  };
};

const handlePay = async (deps: Dependencies, id: string): Promise<Response> => {
  const current = await loadExpense(deps.repository, id);
  if (current === "invalid") {
    return unavailable();
  }
  if (current === undefined) {
    return invalid(404, "missing_expense");
  }
  if (Expense.isPaid(current)) {
    return {
      status: 200,
      body: PublicExpense.fromExpense(current),
    };
  }
  if (!Expense.isApproved(current)) {
    return invalid(409, "conflict");
  }

  let chargeResult: Awaited<ReturnType<Payment["charge"]>>;
  try {
    chargeResult = await deps.payment.charge({
      expenseId: current.id,
      amountCents: current.amountCents,
      email: current.ownerEmail,
      idempotencyKey: current.id,
    });
  } catch {
    return unavailable();
  }

  if (chargeResult.kind === "declined") {
    return invalid(422, "payment_declined");
  }

  const receiptId = ReceiptId.parse(chargeResult.receiptId);
  if (receiptId === undefined) {
    return unavailable();
  }

  const expense = Expense.markPaid(current, receiptId);
  if ((await saveExpense(deps.repository, expense)) === false) {
    return unavailable();
  }

  try {
    log(deps.logger, ExpenseLogEvent.paid(expense.id));
  } catch {
    return unavailable();
  }

  return {
    status: 200,
    body: PublicExpense.fromExpense(expense),
  };
};

const handleGet = async (deps: Dependencies, id: string): Promise<Response> => {
  const current = await loadExpense(deps.repository, id);
  if (current === "invalid") {
    return unavailable();
  }
  if (current === undefined) {
    return invalid(404, "missing_expense");
  }

  return {
    status: 200,
    body: PublicExpense.fromExpense(current),
  };
};

export const createExpenseService = (dependencies: Dependencies) => ({
  handle: async (command: unknown): Promise<Response> => {
    const parsed = Command.parse(command);
    if (parsed === undefined) {
      return invalid(400, "invalid_command");
    }

    switch (parsed.op) {
      case "create":
        return handleCreate(
          dependencies,
          parsed.id,
          parsed.ownerId,
          parsed.ownerEmail,
          parsed.description,
          parsed.amountCents,
        );
      case "submit":
        return handleSubmit(dependencies, parsed.id, parsed.actorId);
      case "approve":
        return handleApprove(dependencies, parsed.id, parsed.actorId);
      case "reject":
        return handleReject(dependencies, parsed.id, parsed.actorId, parsed.reason);
      case "pay":
        return handlePay(dependencies, parsed.id);
      case "get":
        return handleGet(dependencies, parsed.id);
      default:
        return assertNever(parsed);
    }
  },
} as const);
