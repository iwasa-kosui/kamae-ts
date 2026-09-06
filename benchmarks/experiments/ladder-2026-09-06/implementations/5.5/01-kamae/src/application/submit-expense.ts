import { err, ok, type Result } from "neverthrow";
import type { SubmitCommand } from "../api/commands";
import { Expense, type SubmittedExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseLogger } from "../domain/expense/expense-logger";
import type { ExpenseStore } from "../domain/expense/expense-store";

export type SubmitExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "UnavailableOperation" }>
  | Readonly<{ kind: "UnauthorizedSubmit" }>;

export const submitExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: SubmitCommand,
  ): Promise<Result<SubmittedExpense, SubmitExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) {
      return err({ kind: "MissingExpense" });
    }
    if (expense.kind !== "Draft") {
      return err({ kind: "UnavailableOperation" });
    }

    const submitted = Expense.submit(expense, command.actorId);
    return submitted.match(
      async (value) => {
        await store.save(value);
        logger.info({
          expenseId: value.id,
          action: "submitted",
          actorId: command.actorId,
        });
        return ok(value);
      },
      () => err({ kind: "UnauthorizedSubmit" }),
    );
  };
