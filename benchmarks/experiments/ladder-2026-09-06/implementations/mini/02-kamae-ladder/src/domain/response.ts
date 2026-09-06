import type { Expense } from "./expense";

export type ExpenseBody = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

const commonBody = (expense: Expense) => ({
  id: expense.id,
  ownerId: expense.ownerId,
  description: expense.description,
  amountCents: expense.amountCents,
});

export const ExpenseResponse = {
  toBody: (expense: Expense): ExpenseBody => {
    const base = commonBody(expense);

    if (expense.kind === "rejected") {
      return {
        ...base,
        state: expense.kind,
        reviewerId: expense.reviewerId,
        reason: expense.reason,
      };
    }

    if (expense.kind === "paid") {
      return {
        ...base,
        state: expense.kind,
        receiptId: expense.receiptId,
      };
    }

    return {
      ...base,
      state: expense.kind,
    };
  },
} as const;
