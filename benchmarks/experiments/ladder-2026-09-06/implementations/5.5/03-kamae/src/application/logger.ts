import type { ExpenseId } from "../domain/expense/expense-id";

export type ExpenseAction =
  | "created"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid";

export type ExpenseLogger = Readonly<{
  record: (event: Readonly<{ expenseId: ExpenseId; action: ExpenseAction }>) => void;
}>;

