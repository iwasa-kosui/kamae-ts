import type { ExpenseId } from "./expense-id";

export type DiagnosticAction = "create" | "submit" | "approve" | "reject" | "pay";

export type DiagnosticEvent = Readonly<{
  expenseId: ExpenseId;
  action: DiagnosticAction;
}>;

export type DiagnosticLogger = Readonly<{
  info: (event: DiagnosticEvent) => void;
}>;
