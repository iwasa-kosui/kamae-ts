import { err, ok, type Result } from "neverthrow";
import { Expense, type SubmittedExpense } from "../domain/expense";
import type { DiagnosticLogger } from "../domain/diagnostic-logger";
import type { EmployeeId } from "../domain/employee-id";
import type { ExpenseId } from "../domain/expense-id";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense-store";

export type SubmitExpenseError =
  | Readonly<{ kind: "ExpenseNotFound"; expenseId: ExpenseId }>
  | Readonly<{ kind: "UnauthorizedSubmit"; expenseId: ExpenseId }>
  | Readonly<{ kind: "UnavailableStage"; expenseId: ExpenseId }>;

export const submitExpenseUseCase =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: DiagnosticLogger,
  ) =>
  async (
    id: ExpenseId,
    actorId: EmployeeId,
  ): Promise<Result<SubmittedExpense, SubmitExpenseError>> => {
    const expense = await resolver.findById(id);
    if (expense === undefined) {
      return err({ kind: "ExpenseNotFound", expenseId: id });
    }
    if (expense.ownerId !== actorId) {
      return err({ kind: "UnauthorizedSubmit", expenseId: id });
    }
    if (expense.kind !== "DraftExpense") {
      return err({ kind: "UnavailableStage", expenseId: id });
    }

    const submitted = Expense.submit(expense);
    await store.save(submitted);
    logger.info({ expenseId: submitted.id, action: "submit" });
    return ok(submitted);
  };
