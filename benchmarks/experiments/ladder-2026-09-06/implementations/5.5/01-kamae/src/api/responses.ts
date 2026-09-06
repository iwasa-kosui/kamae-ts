import type { Expense } from "../domain/expense/expense";
import { assertNever } from "../shared/assert-never";

export type SuccessBody = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type ErrorBody = Readonly<{ code: string }>;

export type HandleResponse = Readonly<{
  status: number;
  body: SuccessBody | ErrorBody;
}>;

const commonBody = (expense: Expense) => ({
  id: expense.id,
  ownerId: expense.ownerId,
  description: expense.description,
  amountCents: expense.amountCents,
});

export const responseBodyFromExpense = (expense: Expense): SuccessBody => {
  switch (expense.kind) {
    case "Draft":
      return { ...commonBody(expense), state: "draft" };
    case "Submitted":
      return { ...commonBody(expense), state: "submitted" };
    case "Approved":
      return {
        ...commonBody(expense),
        state: "approved",
        reviewerId: expense.reviewerId,
      };
    case "Rejected":
      return {
        ...commonBody(expense),
        state: "rejected",
        reviewerId: expense.reviewerId,
        reason: expense.reason,
      };
    case "Paid":
      return {
        ...commonBody(expense),
        state: "paid",
        reviewerId: expense.reviewerId,
        receiptId: expense.receiptId,
      };
    default:
      return assertNever(expense);
  }
};
