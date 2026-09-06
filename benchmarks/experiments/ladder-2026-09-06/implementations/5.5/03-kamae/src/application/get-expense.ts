import { err, ok, type Result } from "neverthrow";
import type { Expense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseId } from "../domain/expense/expense-id";

export type GetExpenseError = Readonly<{
  kind: "MissingExpense";
}>;

export const getExpense =
  (resolver: ExpenseByIdResolver) =>
  async (id: ExpenseId): Promise<Result<Expense, GetExpenseError>> => {
    const expense = await resolver.findById(id);
    return expense === undefined ? err({ kind: "MissingExpense" }) : ok(expense);
  };

