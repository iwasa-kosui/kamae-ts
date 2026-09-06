import { err, ok, type Result } from "neverthrow";
import { Expense, type ApprovedExpense } from "../domain/expense";
import type { DiagnosticLogger } from "../domain/diagnostic-logger";
import type { EmployeeId } from "../domain/employee-id";
import type { ExpenseId } from "../domain/expense-id";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense-store";

export type ApproveExpenseError =
  | Readonly<{ kind: "ExpenseNotFound"; expenseId: ExpenseId }>
  | Readonly<{ kind: "SelfReview"; expenseId: ExpenseId }>
  | Readonly<{ kind: "UnavailableStage"; expenseId: ExpenseId }>;

export const approveExpenseUseCase =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: DiagnosticLogger,
  ) =>
  async (
    id: ExpenseId,
    actorId: EmployeeId,
  ): Promise<Result<ApprovedExpense, ApproveExpenseError>> => {
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

    const approved = Expense.approve(expense, actorId);
    await store.save(approved);
    logger.info({ expenseId: approved.id, action: "approve" });
    return ok(approved);
  };
