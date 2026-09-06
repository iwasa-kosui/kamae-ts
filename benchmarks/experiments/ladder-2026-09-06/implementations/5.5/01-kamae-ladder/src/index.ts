import { Result } from "neverthrow";
import { Command } from "./application/commands";
import {
  approveExpense,
  createExpense,
  getExpense,
  payExpense,
  rejectExpense,
  submitExpense,
  type PaymentGateway,
  type UseCaseError,
  type UseCaseSuccess,
} from "./application/use-cases";
import type { ExpenseResolver } from "./domain/expense-resolver";
import type { ExpenseStore } from "./domain/expense-store";
import { Expense, type PublicExpense } from "./domain/expense";
import type { ExpenseId } from "./domain/value-objects";
import { PaymentResponse } from "./infrastructure/payment-codec";
import { StoredExpense } from "./infrastructure/storage-codec";
import { assertNever } from "./result";

type HostRepository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

type HostPayment = Readonly<{
  charge: (request: {
    readonly expenseId: string;
    readonly amountCents: number;
    readonly email: string;
    readonly idempotencyKey: string;
  }) => Promise<unknown>;
}>;

type HostLogger = Readonly<{
  info: (event: unknown) => void;
}>;

export type ExpenseServiceDependencies = Readonly<{
  repository: HostRepository;
  payment: HostPayment;
  logger: HostLogger;
}>;

type SuccessResponse = Readonly<{
  status: 200 | 201;
  body: PublicExpense;
}>;

type ErrorResponse = Readonly<{
  status: 400 | 403 | 404 | 409 | 422 | 500;
  body: Readonly<{ code: string }>;
}>;

export type ExpenseServiceResponse = SuccessResponse | ErrorResponse;

export type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<ExpenseServiceResponse>;
}>;

const invalidStorage = new Error("Invalid stored expense");
const invalidGateway = new Error("Invalid payment response");

const makeResolver = (repository: HostRepository): ExpenseResolver => ({
  findById: async (id: ExpenseId) => {
    const stored = await repository.get(id);
    if (stored === undefined) {
      return undefined;
    }

    const parsed = StoredExpense.parse(stored);
    if (parsed.isErr()) {
      throw invalidStorage;
    }

    return StoredExpense.decode(parsed.value);
  },
});

const makeStore = (repository: HostRepository): ExpenseStore => ({
  save: async (expense) => {
    await repository.save(expense.id, StoredExpense.encode(expense));
  },
});

const makePaymentGateway = (payment: HostPayment): PaymentGateway => ({
  charge: async (request) => {
    const response = await payment.charge(request);
    const parsed = PaymentResponse.parse(response);
    if (parsed.isErr()) {
      throw invalidGateway;
    }
    return parsed.value;
  },
});

const successResponse = (
  result: UseCaseSuccess,
  createStatus: 200 | 201,
): SuccessResponse => ({
  status: result.action === "created" ? createStatus : 200,
  body: Expense.toPublic(result.expense),
});

const errorResponse = (error: UseCaseError): ErrorResponse => {
  switch (error.kind) {
    case "NotFound":
      return { status: 404, body: { code: "not_found" } };
    case "Conflict":
      return { status: 409, body: { code: "conflict" } };
    case "Unauthorized":
      return { status: 403, body: { code: "forbidden" } };
    case "PaymentDeclined":
      return { status: 422, body: { code: "payment_declined" } };
    default:
      return assertNever(error);
  }
};

const useCaseResponse = async (
  result: Promise<Result<UseCaseSuccess, UseCaseError>>,
  logger: HostLogger,
): Promise<ExpenseServiceResponse> => {
  const handled = await result;
  return handled.match(
    (success) => {
      if (success.action !== undefined) {
        logger.info({ expenseId: success.expense.id, action: success.action });
      }
      return successResponse(success, 201);
    },
    errorResponse,
  );
};

export const createExpenseService = (
  dependencies: ExpenseServiceDependencies,
): ExpenseService => {
  const resolver = makeResolver(dependencies.repository);
  const store = makeStore(dependencies.repository);
  const payment = makePaymentGateway(dependencies.payment);

  return {
    handle: async (rawCommand) => {
      try {
        const parsed = Command.parse(rawCommand);
        if (parsed.isErr()) {
          return { status: 400, body: { code: "invalid_command" } };
        }

        const command = parsed.value;
        switch (command.op) {
          case "create":
            return await useCaseResponse(
              createExpense(resolver, store, command),
              dependencies.logger,
            );
          case "submit":
            return await useCaseResponse(
              submitExpense(resolver, store, command),
              dependencies.logger,
            );
          case "approve":
            return await useCaseResponse(
              approveExpense(resolver, store, command),
              dependencies.logger,
            );
          case "reject":
            return await useCaseResponse(
              rejectExpense(resolver, store, command),
              dependencies.logger,
            );
          case "pay":
            return await useCaseResponse(
              payExpense(resolver, store, payment, command),
              dependencies.logger,
            );
          case "get":
            return await useCaseResponse(
              getExpense(resolver, command),
              dependencies.logger,
            );
          default:
            return assertNever(command);
        }
      } catch {
        return { status: 500, body: { code: "unavailable" } };
      }
    },
  };
};
