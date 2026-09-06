import type { Expense } from "./expense";
import type { ExpenseId } from "./value-objects";

export type ExpenseResolver = Readonly<{
  findById: (id: ExpenseId) => Promise<Expense | undefined>;
}>;
