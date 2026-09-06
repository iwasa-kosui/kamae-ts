import type { Expense } from "./expense";
import type { ExpenseId } from "./expense-id";

export type ExpenseByIdResolver = Readonly<{
  findById: (id: ExpenseId) => Promise<Expense | undefined>;
}>;

