import type { Expense } from "./expense";

export type ExpenseStore = Readonly<{
  save: (expense: Expense) => Promise<void>;
}>;

