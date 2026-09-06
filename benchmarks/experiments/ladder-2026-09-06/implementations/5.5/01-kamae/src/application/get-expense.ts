import { err, ok, type Result } from "neverthrow";
import type { GetCommand } from "../api/commands";
import type { Expense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";

export type GetExpenseError = Readonly<{ kind: "MissingExpense" }>;

export const getExpense =
  (resolver: ExpenseByIdResolver) =>
  async (command: GetCommand): Promise<Result<Expense, GetExpenseError>> => {
    const expense = await resolver.findById(command.id);
    return expense === undefined
      ? err({ kind: "MissingExpense" })
      : ok(expense);
  };
