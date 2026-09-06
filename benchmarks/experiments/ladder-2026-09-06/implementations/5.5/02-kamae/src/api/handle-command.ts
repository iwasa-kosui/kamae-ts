import { Command } from "./command";
import { errorResponse, successResponse, type ApiResponse } from "./response";
import type { DiagnosticLogger } from "../domain/diagnostic-logger";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense-store";
import type { PaymentGateway } from "../domain/payment-gateway";
import { approveExpenseUseCase } from "../use-cases/approve-expense";
import { createExpenseUseCase } from "../use-cases/create-expense";
import { getExpenseUseCase } from "../use-cases/get-expense";
import { payExpenseUseCase } from "../use-cases/pay-expense";
import { rejectExpenseUseCase } from "../use-cases/reject-expense";
import { submitExpenseUseCase } from "../use-cases/submit-expense";

export type CommandHandlerDependencies = Readonly<{
  resolver: ExpenseByIdResolver;
  store: ExpenseStore;
  payment: PaymentGateway;
  logger: DiagnosticLogger;
}>;

export const handleCommand =
  (dependencies: CommandHandlerDependencies) =>
  async (rawCommand: unknown): Promise<ApiResponse> => {
    try {
      return await Command.parse(rawCommand).match(
        async (command) => {
          switch (command.op) {
            case "create":
              return createExpenseUseCase(
                dependencies.resolver,
                dependencies.store,
                dependencies.logger,
              )(command).then((result) =>
                result.match(
                  (expense) => successResponse(201, expense),
                  () => errorResponse(409, "duplicate_expense"),
                ),
              );
            case "submit":
              return submitExpenseUseCase(
                dependencies.resolver,
                dependencies.store,
                dependencies.logger,
              )(command.id, command.actorId).then((result) =>
                result.match(
                  (expense) => successResponse(200, expense),
                  (failure) =>
                    failure.kind === "ExpenseNotFound"
                      ? errorResponse(404, "missing_expense")
                      : failure.kind === "UnauthorizedSubmit"
                        ? errorResponse(403, "unauthorized_submit")
                        : errorResponse(409, "unavailable_stage"),
                ),
              );
            case "approve":
              return approveExpenseUseCase(
                dependencies.resolver,
                dependencies.store,
                dependencies.logger,
              )(command.id, command.actorId).then((result) =>
                result.match(
                  (expense) => successResponse(200, expense),
                  (failure) =>
                    failure.kind === "ExpenseNotFound"
                      ? errorResponse(404, "missing_expense")
                      : failure.kind === "SelfReview"
                        ? errorResponse(403, "self_review")
                        : errorResponse(409, "unavailable_stage"),
                ),
              );
            case "reject":
              return rejectExpenseUseCase(
                dependencies.resolver,
                dependencies.store,
                dependencies.logger,
              )(command.id, command.actorId, command.reason).then((result) =>
                result.match(
                  (expense) => successResponse(200, expense),
                  (failure) =>
                    failure.kind === "ExpenseNotFound"
                      ? errorResponse(404, "missing_expense")
                      : failure.kind === "SelfReview"
                        ? errorResponse(403, "self_review")
                        : errorResponse(409, "unavailable_stage"),
                ),
              );
            case "pay":
              return payExpenseUseCase(
                dependencies.resolver,
                dependencies.store,
                dependencies.payment,
                dependencies.logger,
              )(command.id).then((result) =>
                result.match(
                  (expense) => successResponse(200, expense),
                  (failure) =>
                    failure.kind === "ExpenseNotFound"
                      ? errorResponse(404, "missing_expense")
                      : failure.kind === "PaymentDeclined"
                        ? errorResponse(422, "payment_declined")
                        : errorResponse(409, "unavailable_stage"),
                ),
              );
            case "get":
              return getExpenseUseCase(dependencies.resolver)(command.id).then((result) =>
                result.match(
                  (expense) => successResponse(200, expense),
                  () => errorResponse(404, "missing_expense"),
                ),
              );
          }
        },
        async () => errorResponse(400, "invalid_command"),
      );
    } catch {
      return errorResponse(500, "service_unavailable");
    }
  };
