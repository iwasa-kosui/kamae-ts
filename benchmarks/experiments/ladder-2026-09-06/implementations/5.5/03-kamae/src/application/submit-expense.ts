import { err, ok, type Result } from "neverthrow";
import { Expense, type SubmittedExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { EmployeeId } from "../domain/expense/employee-id";
import type { ExpenseId } from "../domain/expense/expense-id";
import type { ExpenseLogger } from "./logger";

export type SubmitExpenseCommand = Readonly<{
  id: ExpenseId;
  actorId: EmployeeId;
}>;

export type SubmitExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "Forbidden" }>
  | Readonly<{ kind: "InvalidStage" }>;

export const submitExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: SubmitExpenseCommand,
  ): Promise<Result<SubmittedExpense, SubmitExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) return err({ kind: "MissingExpense" });
    if (expense.kind !== "DraftExpense") return err({ kind: "InvalidStage" });
    if (expense.ownerId !== command.actorId) return err({ kind: "Forbidden" });

    const submitted = Expense.submit(expense);
    await store.save(submitted);
    logger.record({ expenseId: submitted.id, action: "submitted" });
    return ok(submitted);
  };

