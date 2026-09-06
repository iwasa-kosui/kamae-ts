import { err, ok, type Result } from "neverthrow";
import { Expense, type DraftExpense } from "../domain/expense";
import type { DiagnosticLogger } from "../domain/diagnostic-logger";
import type { AmountCents } from "../domain/amount-cents";
import type { EmployeeId } from "../domain/employee-id";
import type { ExpenseDescription } from "../domain/expense-description";
import type { ExpenseId } from "../domain/expense-id";
import type { OwnerEmail } from "../domain/owner-email";
import type { Sensitive } from "../domain/sensitive";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense-store";

export type CreateExpenseInput = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: Sensitive<OwnerEmail>;
  description: ExpenseDescription;
  amountCents: AmountCents;
}>;

export type CreateExpenseError = Readonly<{
  kind: "DuplicateExpense";
  expenseId: ExpenseId;
}>;

export const createExpenseUseCase =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: DiagnosticLogger,
  ) =>
  async (input: CreateExpenseInput): Promise<Result<DraftExpense, CreateExpenseError>> => {
    const existing = await resolver.findById(input.id);
    if (existing !== undefined) {
      return err({ kind: "DuplicateExpense", expenseId: input.id });
    }

    const expense = Expense.create(input);
    await store.save(expense);
    logger.info({ expenseId: expense.id, action: "create" });
    return ok(expense);
  };
