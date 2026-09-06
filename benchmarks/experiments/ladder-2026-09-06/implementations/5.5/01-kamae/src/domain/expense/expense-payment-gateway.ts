import type { ApprovedExpense } from "./expense";

export type ExpensePaymentResult =
  | Readonly<{ kind: "paid"; receiptId: string }>
  | Readonly<{ kind: "declined" }>;

export type ExpensePaymentGateway = Readonly<{
  charge: (expense: ApprovedExpense) => Promise<ExpensePaymentResult>;
}>;
