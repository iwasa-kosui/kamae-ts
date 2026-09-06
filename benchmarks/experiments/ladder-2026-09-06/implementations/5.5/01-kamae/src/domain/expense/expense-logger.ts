export type ExpenseLogEvent = Readonly<{
  expenseId: string;
  action: "created" | "submitted" | "approved" | "rejected" | "paid";
  actorId?: string;
}>;

export type ExpenseLogger = Readonly<{
  info: (event: ExpenseLogEvent) => void;
}>;
