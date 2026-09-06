export type ExpenseLogEvent = Readonly<{
  kind: "expense_event";
  expenseId: string;
  action: "created" | "submitted" | "approved" | "rejected" | "paid";
}>;

export const ExpenseLogEvent = {
  created: (expenseId: string): ExpenseLogEvent => ({
    kind: "expense_event",
    expenseId,
    action: "created",
  }),
  submitted: (expenseId: string): ExpenseLogEvent => ({
    kind: "expense_event",
    expenseId,
    action: "submitted",
  }),
  approved: (expenseId: string): ExpenseLogEvent => ({
    kind: "expense_event",
    expenseId,
    action: "approved",
  }),
  rejected: (expenseId: string): ExpenseLogEvent => ({
    kind: "expense_event",
    expenseId,
    action: "rejected",
  }),
  paid: (expenseId: string): ExpenseLogEvent => ({
    kind: "expense_event",
    expenseId,
    action: "paid",
  }),
} as const;
