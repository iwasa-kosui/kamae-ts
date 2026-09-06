import { err, ok, type Result } from "neverthrow";
import type { ApproveCommand } from "../api/commands";
import { Expense, type ApprovedExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseLogger } from "../domain/expense/expense-logger";
import type { ExpenseStore } from "../domain/expense/expense-store";

export type ApproveExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "UnavailableOperation" }>
  | Readonly<{ kind: "SelfReview" }>;

export const approveExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: ApproveCommand,
  ): Promise<Result<ApprovedExpense, ApproveExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) {
      return err({ kind: "MissingExpense" });
    }
    if (expense.kind !== "Submitted") {
      return err({ kind: "UnavailableOperation" });
    }

    const approved = Expense.approve(expense, command.actorId);
    return approved.match(
      async (value) => {
        await store.save(value);
        logger.info({
          expenseId: value.id,
          action: "approved",
          actorId: command.actorId,
        });
        return ok(value);
      },
      () => err({ kind: "SelfReview" }),
    );
  };
