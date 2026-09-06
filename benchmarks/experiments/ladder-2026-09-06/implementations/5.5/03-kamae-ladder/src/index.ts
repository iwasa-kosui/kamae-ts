import { Expense, Sensitive, type Expense as ExpenseEntity } from "./domain/expense";
import { Command, StoredExpense, type Command as ParsedCommand } from "./application/validation";

type Repository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

type PaymentResult =
  | Readonly<{ kind: "paid"; receiptId: string }>
  | Readonly<{ kind: "declined" }>;

type PaymentGateway = Readonly<{
  charge: (request: {
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }) => Promise<PaymentResult>;
}>;

type Logger = Readonly<{
  info: (event: Readonly<{ expenseId: string; action: string }>) => void;
}>;

export type ExpenseServiceDependencies = Readonly<{
  repository: Repository;
  payment: PaymentGateway;
  logger: Logger;
}>;

export type ExpenseServiceResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<ExpenseServiceResponse>;
}>;

const success = (status: 200 | 201, expense: ExpenseEntity): ExpenseServiceResponse => ({
  status,
  body: Expense.toResponseBody(expense),
});

const failure = (status: number, code: string): ExpenseServiceResponse => ({
  status,
  body: { code },
});

const logChange = (
  logger: Logger,
  expenseId: string,
  action: "created" | "submitted" | "approved" | "rejected" | "paid",
) => {
  logger.info({ expenseId, action });
};

const loadExpense = async (
  repository: Repository,
  id: string,
): Promise<ExpenseEntity | undefined | "invalid"> => {
  const stored = await repository.get(id);
  if (stored === undefined) return undefined;

  const parsed = StoredExpense.parse(stored);
  return parsed.ok ? parsed.value : "invalid";
};

const saveExpense = async (repository: Repository, expense: ExpenseEntity) => {
  await repository.save(expense.id, StoredExpense.fromDomain(expense));
};

const isUsablePaymentResult = (result: PaymentResult): boolean =>
  result.kind === "declined" ||
  (result.kind === "paid" && result.receiptId.trim().length > 0);

const handleParsed = async (
  dependencies: ExpenseServiceDependencies,
  command: ParsedCommand,
): Promise<ExpenseServiceResponse> => {
  const { repository, payment, logger } = dependencies;

  switch (command.op) {
    case "create": {
      const existing = await repository.get(command.id);
      if (existing !== undefined) return failure(409, "duplicate_id");

      const expense = Expense.createDraft({
        id: command.id,
        ownerId: command.ownerId,
        ownerEmail: Sensitive.of(command.ownerEmail),
        description: command.description,
        amountCents: command.amountCents,
      });
      await saveExpense(repository, expense);
      logChange(logger, expense.id, "created");
      return success(201, expense);
    }
    case "submit": {
      const expense = await loadExpense(repository, command.id);
      if (expense === undefined) return failure(404, "not_found");
      if (expense === "invalid") return failure(500, "invalid_dependency_response");
      if (expense.ownerId !== command.actorId) return failure(403, "forbidden");
      if (expense.kind !== "draft") return failure(409, "invalid_state");

      const submitted = Expense.submit(expense);
      await saveExpense(repository, submitted);
      logChange(logger, submitted.id, "submitted");
      return success(200, submitted);
    }
    case "approve": {
      const expense = await loadExpense(repository, command.id);
      if (expense === undefined) return failure(404, "not_found");
      if (expense === "invalid") return failure(500, "invalid_dependency_response");
      if (expense.kind !== "submitted") return failure(409, "invalid_state");
      if (expense.ownerId === command.actorId) return failure(403, "forbidden");

      const approved = Expense.approve(expense, command.actorId);
      await saveExpense(repository, approved);
      logChange(logger, approved.id, "approved");
      return success(200, approved);
    }
    case "reject": {
      const expense = await loadExpense(repository, command.id);
      if (expense === undefined) return failure(404, "not_found");
      if (expense === "invalid") return failure(500, "invalid_dependency_response");
      if (expense.kind !== "submitted") return failure(409, "invalid_state");
      if (expense.ownerId === command.actorId) return failure(403, "forbidden");

      const rejected = Expense.reject(expense, command.actorId, command.reason);
      await saveExpense(repository, rejected);
      logChange(logger, rejected.id, "rejected");
      return success(200, rejected);
    }
    case "pay": {
      const expense = await loadExpense(repository, command.id);
      if (expense === undefined) return failure(404, "not_found");
      if (expense === "invalid") return failure(500, "invalid_dependency_response");
      if (expense.kind === "paid") return success(200, expense);
      if (expense.kind !== "approved") return failure(409, "invalid_state");

      const paymentResult = await payment.charge({
        expenseId: expense.id,
        amountCents: expense.amountCents,
        email: expense.ownerEmail.unwrap(),
        idempotencyKey: expense.id,
      });

      if (!isUsablePaymentResult(paymentResult)) {
        return failure(500, "invalid_dependency_response");
      }
      if (paymentResult.kind === "declined") return failure(422, "payment_declined");

      const paid = Expense.markPaid(expense, paymentResult.receiptId);
      await saveExpense(repository, paid);
      logChange(logger, paid.id, "paid");
      return success(200, paid);
    }
    case "get": {
      const expense = await loadExpense(repository, command.id);
      if (expense === undefined) return failure(404, "not_found");
      if (expense === "invalid") return failure(500, "invalid_dependency_response");
      return success(200, expense);
    }
  }
};

export const createExpenseService = (
  dependencies: ExpenseServiceDependencies,
): ExpenseService => ({
  handle: async (rawCommand: unknown): Promise<ExpenseServiceResponse> => {
    const parsed = Command.parse(rawCommand);
    if (!parsed.ok) return failure(400, "invalid_command");

    try {
      return await handleParsed(dependencies, parsed.value);
    } catch {
      return failure(500, "service_unavailable");
    }
  },
});
