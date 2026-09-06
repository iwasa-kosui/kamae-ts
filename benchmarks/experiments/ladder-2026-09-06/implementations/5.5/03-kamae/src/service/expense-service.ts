import { approveExpense } from "../application/approve-expense";
import { createExpense } from "../application/create-expense";
import { getExpense } from "../application/get-expense";
import { payExpense } from "../application/pay-expense";
import { rejectExpense } from "../application/reject-expense";
import { submitExpense } from "../application/submit-expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { ExpenseLogger } from "../application/logger";
import type { PaymentCharger } from "../application/payment-charger";
import { assertNever } from "../domain/expense/assert-never";
import { Command } from "./command";
import { response, type ApiResponse } from "./response";

export type ExpenseServiceDependencies = Readonly<{
  resolver: ExpenseByIdResolver;
  store: ExpenseStore;
  payment: PaymentCharger;
  logger: ExpenseLogger;
}>;

export type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<ApiResponse>;
}>;

export const createExpenseServiceAdapter = (
  dependencies: ExpenseServiceDependencies,
): ExpenseService => {
  const create = createExpense(
    dependencies.resolver,
    dependencies.store,
    dependencies.logger,
  );
  const submit = submitExpense(
    dependencies.resolver,
    dependencies.store,
    dependencies.logger,
  );
  const approve = approveExpense(
    dependencies.resolver,
    dependencies.store,
    dependencies.logger,
  );
  const reject = rejectExpense(
    dependencies.resolver,
    dependencies.store,
    dependencies.logger,
  );
  const pay = payExpense(
    dependencies.resolver,
    dependencies.store,
    dependencies.payment,
    dependencies.logger,
  );
  const get = getExpense(dependencies.resolver);

  return {
    handle: async (rawCommand) => {
      const parsed = Command.parse(rawCommand);
      if (parsed.isErr()) {
        return response.error(400, "invalid_command");
      }

      try {
        const command = parsed.value;

        switch (command.op) {
          case "create": {
            const result = await create(command);
            return result.match(
              (expense) => response.expense(201, expense),
              () => response.error(409, "conflict"),
            );
          }
          case "submit": {
            const result = await submit(command);
            return result.match((expense) => response.expense(200, expense), (error) =>
              error.kind === "MissingExpense"
                ? response.error(404, "not_found")
                : error.kind === "Forbidden"
                  ? response.error(403, "forbidden")
                  : response.error(409, "conflict"),
            );
          }
          case "approve": {
            const result = await approve(command);
            return result.match((expense) => response.expense(200, expense), (error) =>
              error.kind === "MissingExpense"
                ? response.error(404, "not_found")
                : error.kind === "Forbidden"
                  ? response.error(403, "forbidden")
                  : response.error(409, "conflict"),
            );
          }
          case "reject": {
            const result = await reject(command);
            return result.match((expense) => response.expense(200, expense), (error) =>
              error.kind === "MissingExpense"
                ? response.error(404, "not_found")
                : error.kind === "Forbidden"
                  ? response.error(403, "forbidden")
                  : response.error(409, "conflict"),
            );
          }
          case "pay": {
            const result = await pay(command.id);
            return result.match((expense) => response.expense(200, expense), (error) =>
              error.kind === "MissingExpense"
                ? response.error(404, "not_found")
                : error.kind === "PaymentDeclined"
                  ? response.error(422, "payment_declined")
                  : response.error(409, "conflict"),
            );
          }
          case "get": {
            const result = await get(command.id);
            return result.match(
              (expense) => response.expense(200, expense),
              () => response.error(404, "not_found"),
            );
          }
          default:
            return assertNever(command);
        }
      } catch {
        return response.error(500, "service_unavailable");
      }
    },
  };
};

