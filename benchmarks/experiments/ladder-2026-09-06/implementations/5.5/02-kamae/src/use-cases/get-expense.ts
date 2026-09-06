import { err, ok, type Result } from "neverthrow";
import type { Expense } from "../domain/expense";
import type { ExpenseId } from "../domain/expense-id";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";

export type GetExpenseError = Readonly<{
  kind: "ExpenseNotFound";
  expenseId: ExpenseId;
}>;

export const getExpenseUseCase =
  (resolver: ExpenseByIdResolver) =>
  async (id: ExpenseId): Promise<Result<Expense, GetExpenseError>> => {
    const expense = await resolver.findById(id);
    return expense === undefined
      ? err({ kind: "ExpenseNotFound", expenseId: id })
      : ok(expense);
  };
