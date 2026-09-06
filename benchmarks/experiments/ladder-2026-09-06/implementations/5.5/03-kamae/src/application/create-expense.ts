import { err, ok, type Result } from "neverthrow";
import { Expense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { AmountCents } from "../domain/expense/amount-cents";
import type { Description } from "../domain/expense/description";
import type { SensitiveEmailAddress } from "../domain/expense/email-address";
import type { EmployeeId } from "../domain/expense/employee-id";
import type { ExpenseId } from "../domain/expense/expense-id";
import type { ExpenseLogger } from "./logger";

export type CreateExpenseCommand = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveEmailAddress;
  description: Description;
  amountCents: AmountCents;
}>;

export type CreateExpenseError = Readonly<{
  kind: "DuplicateExpense";
}>;

export const createExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: CreateExpenseCommand,
  ): Promise<Result<Expense, CreateExpenseError>> => {
    const existing = await resolver.findById(command.id);
    if (existing !== undefined) {
      return err({ kind: "DuplicateExpense" });
    }

    const expense = Expense.draft(command);
    await store.save(expense);
    logger.record({ expenseId: expense.id, action: "created" });
    return ok(expense);
  };

