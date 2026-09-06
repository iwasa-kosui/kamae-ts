import type { Expense } from "../domain/expense";
import { assertNever } from "../support/assert-never";

export type ApiSuccessBody = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type ApiErrorBody = Readonly<{
  code: string;
}>;

export type ApiResponse = Readonly<{
  status: number;
  body: ApiSuccessBody | ApiErrorBody;
}>;

const commonBody = (expense: Expense) => ({
  id: expense.id,
  ownerId: expense.ownerId,
  description: expense.description,
  amountCents: expense.amountCents,
});

export const toSuccessBody = (expense: Expense): ApiSuccessBody => {
  switch (expense.kind) {
    case "DraftExpense":
      return { ...commonBody(expense), state: "draft" };
    case "SubmittedExpense":
      return { ...commonBody(expense), state: "submitted" };
    case "ApprovedExpense":
      return { ...commonBody(expense), state: "approved", reviewerId: expense.reviewerId };
    case "RejectedExpense":
      return {
        ...commonBody(expense),
        state: "rejected",
        reviewerId: expense.reviewerId,
        reason: expense.reason,
      };
    case "PaidExpense":
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

export const successResponse = (status: 200 | 201, expense: Expense): ApiResponse => ({
  status,
  body: toSuccessBody(expense),
});

export const errorResponse = (status: number, code: string): ApiResponse => ({
  status,
  body: { code },
});
