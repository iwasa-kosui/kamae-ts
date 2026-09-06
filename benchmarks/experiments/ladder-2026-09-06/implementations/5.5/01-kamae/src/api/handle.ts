import { approveExpense } from "../application/approve-expense";
import { createExpense } from "../application/create-expense";
import { getExpense } from "../application/get-expense";
import { payExpense } from "../application/pay-expense";
import { rejectExpense } from "../application/reject-expense";
import { submitExpense } from "../application/submit-expense";
import { assertNever } from "../shared/assert-never";
import { createAdapters } from "./adapters";
import { Command } from "./commands";
import type { ExpenseServiceDependencies } from "./dependencies";
import {
  responseBodyFromExpense,
  type HandleResponse,
} from "./responses";

const errorResponse = (status: number, code: string): HandleResponse => ({
  status,
  body: { code },
});

export const createHandle =
  (dependencies: ExpenseServiceDependencies) =>
  async (rawCommand: unknown): Promise<HandleResponse> => {
    try {
      const command = Command.parse(rawCommand);
      if (command.isErr()) {
        return errorResponse(400, "invalid_command");
      }

      const { resolver, store, paymentGateway, logger } =
        createAdapters(dependencies);

      switch (command.value.op) {
        case "create": {
          const result = await createExpense(resolver, store, logger)(
            command.value,
          );
          return result.match(
            (expense) => ({
              status: 201,
              body: responseBodyFromExpense(expense),
            }),
            () => errorResponse(409, "duplicate_expense"),
          );
        }
        case "submit": {
          const result = await submitExpense(resolver, store, logger)(
            command.value,
          );
          return result.match(
            (expense) => ({
              status: 200,
              body: responseBodyFromExpense(expense),
            }),
            (error) => {
              switch (error.kind) {
                case "MissingExpense":
                  return errorResponse(404, "missing_expense");
                case "UnavailableOperation":
                  return errorResponse(409, "operation_unavailable");
                case "UnauthorizedSubmit":
                  return errorResponse(403, "unauthorized_submit");
                default:
                  return assertNever(error);
              }
            },
          );
        }
        case "approve": {
          const result = await approveExpense(resolver, store, logger)(
            command.value,
          );
          return result.match(
            (expense) => ({
              status: 200,
              body: responseBodyFromExpense(expense),
            }),
            (error) => {
              switch (error.kind) {
                case "MissingExpense":
                  return errorResponse(404, "missing_expense");
                case "UnavailableOperation":
                  return errorResponse(409, "operation_unavailable");
                case "SelfReview":
                  return errorResponse(403, "self_review");
                default:
                  return assertNever(error);
              }
            },
          );
        }
        case "reject": {
          const result = await rejectExpense(resolver, store, logger)(
            command.value,
          );
          return result.match(
            (expense) => ({
              status: 200,
              body: responseBodyFromExpense(expense),
            }),
            (error) => {
              switch (error.kind) {
                case "MissingExpense":
                  return errorResponse(404, "missing_expense");
                case "UnavailableOperation":
                  return errorResponse(409, "operation_unavailable");
                case "SelfReview":
                  return errorResponse(403, "self_review");
                default:
                  return assertNever(error);
              }
            },
          );
        }
        case "pay": {
          const result = await payExpense(
            resolver,
            store,
            paymentGateway,
            logger,
          )(command.value);
          return result.match(
            (expense) => ({
              status: 200,
              body: responseBodyFromExpense(expense),
            }),
            (error) => {
              switch (error.kind) {
                case "MissingExpense":
                  return errorResponse(404, "missing_expense");
                case "UnavailableOperation":
                  return errorResponse(409, "operation_unavailable");
                case "PaymentDeclined":
                  return errorResponse(422, "payment_declined");
                default:
                  return assertNever(error);
              }
            },
          );
        }
        case "get": {
          const result = await getExpense(resolver)(command.value);
          return result.match(
            (expense) => ({
              status: 200,
              body: responseBodyFromExpense(expense),
            }),
            () => errorResponse(404, "missing_expense"),
          );
        }
        default:
          return assertNever(command.value);
      }
    } catch {
      return errorResponse(500, "service_unavailable");
    }
  };
