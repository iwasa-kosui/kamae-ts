import { err, ok, type Result } from "neverthrow";
import { Expense, type RejectedExpense } from "../domain/expense";
import type { DiagnosticLogger } from "../domain/diagnostic-logger";
import type { EmployeeId } from "../domain/employee-id";
import type { ExpenseId } from "../domain/expense-id";
import type { RejectionReason } from "../domain/rejection-reason";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense-store";

export type RejectExpenseError =
  | Readonly<{ kind: "ExpenseNotFound"; expenseId: ExpenseId }>
  | Readonly<{ kind: "SelfReview"; expenseId: ExpenseId }>
  | Readonly<{ kind: "UnavailableStage"; expenseId: ExpenseId }>;

export const rejectExpenseUseCase =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: DiagnosticLogger,
  ) =>
  async (
    id: ExpenseId,
    actorId: EmployeeId,
    reason: RejectionReason,
  ): Promise<Result<RejectedExpense, RejectExpenseError>> => {
    const expense = await resolver.findById(id);
    if (expense === undefined) {
      return err({ kind: "ExpenseNotFound", expenseId: id });
    }
    if (expense.ownerId === actorId) {
      return err({ kind: "SelfReview", expenseId: id });
    }
    if (expense.kind !== "SubmittedExpense") {
      return err({ kind: "UnavailableStage", expenseId: id });
    }

    const rejected = Expense.reject(expense, actorId, reason);
    await store.save(rejected);
    logger.info({ expenseId: rejected.id, action: "reject" });
    return ok(rejected);
  };
