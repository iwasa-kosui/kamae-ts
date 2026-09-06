import { err, ok, type Result } from "neverthrow";
import { Expense, type RejectedExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { EmployeeId } from "../domain/expense/employee-id";
import type { ExpenseId } from "../domain/expense/expense-id";
import type { RejectionReason } from "../domain/expense/rejection-reason";
import type { ExpenseLogger } from "./logger";

export type RejectExpenseCommand = Readonly<{
  id: ExpenseId;
  actorId: EmployeeId;
  reason: RejectionReason;
}>;

export type RejectExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "Forbidden" }>
  | Readonly<{ kind: "InvalidStage" }>;

export const rejectExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: RejectExpenseCommand,
  ): Promise<Result<RejectedExpense, RejectExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) return err({ kind: "MissingExpense" });
    if (expense.kind !== "SubmittedExpense") return err({ kind: "InvalidStage" });
    if (expense.ownerId === command.actorId) return err({ kind: "Forbidden" });

    const rejected = Expense.reject(expense, command.actorId, command.reason);
    await store.save(rejected);
    logger.record({ expenseId: rejected.id, action: "rejected" });
    return ok(rejected);
  };

