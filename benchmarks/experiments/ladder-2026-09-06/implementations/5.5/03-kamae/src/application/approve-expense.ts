import { err, ok, type Result } from "neverthrow";
import { Expense, type ApprovedExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { EmployeeId } from "../domain/expense/employee-id";
import type { ExpenseId } from "../domain/expense/expense-id";
import type { ExpenseLogger } from "./logger";

export type ApproveExpenseCommand = Readonly<{
  id: ExpenseId;
  actorId: EmployeeId;
}>;

export type ApproveExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "Forbidden" }>
  | Readonly<{ kind: "InvalidStage" }>;

export const approveExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: ApproveExpenseCommand,
  ): Promise<Result<ApprovedExpense, ApproveExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) return err({ kind: "MissingExpense" });
    if (expense.kind !== "SubmittedExpense") return err({ kind: "InvalidStage" });
    if (expense.ownerId === command.actorId) return err({ kind: "Forbidden" });

    const approved = Expense.approve(expense, command.actorId);
    await store.save(approved);
    logger.record({ expenseId: approved.id, action: "approved" });
    return ok(approved);
  };

