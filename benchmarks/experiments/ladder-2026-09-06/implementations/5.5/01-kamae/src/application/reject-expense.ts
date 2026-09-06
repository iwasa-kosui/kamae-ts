import { err, ok, type Result } from "neverthrow";
import type { RejectCommand } from "../api/commands";
import { Expense, type RejectedExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseLogger } from "../domain/expense/expense-logger";
import type { ExpenseStore } from "../domain/expense/expense-store";

export type RejectExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "UnavailableOperation" }>
  | Readonly<{ kind: "SelfReview" }>;

export const rejectExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: RejectCommand,
  ): Promise<Result<RejectedExpense, RejectExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) {
      return err({ kind: "MissingExpense" });
    }
    if (expense.kind !== "Submitted") {
      return err({ kind: "UnavailableOperation" });
    }

    const rejected = Expense.reject(expense, command.actorId, command.reason);
    return rejected.match(
      async (value) => {
        await store.save(value);
        logger.info({
          expenseId: value.id,
          action: "rejected",
          actorId: command.actorId,
        });
        return ok(value);
      },
      () => err({ kind: "SelfReview" }),
    );
  };
