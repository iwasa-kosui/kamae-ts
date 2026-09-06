import { assertNever } from "../domain/expense/assert-never";
import type { Expense } from "../domain/expense/expense";

export type SuccessStatus = 200 | 201;
export type ErrorStatus = 400 | 403 | 404 | 409 | 422 | 500;

export type ExpenseResponseBody = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type ErrorResponseBody = Readonly<{
  code: string;
}>;

export type ApiResponse =
  | Readonly<{ status: SuccessStatus; body: ExpenseResponseBody }>
  | Readonly<{ status: ErrorStatus; body: ErrorResponseBody }>;

export const response = {
  expense: (status: SuccessStatus, expense: Expense): ApiResponse => {
    const shared = {
      id: expense.id,
      ownerId: expense.ownerId,
      description: expense.description,
      amountCents: expense.amountCents,
    };

    switch (expense.kind) {
      case "DraftExpense":
        return {
          status,
          body: {
            ...shared,
            state: "draft",
          },
        };
      case "SubmittedExpense":
        return {
          status,
          body: {
            ...shared,
            state: "submitted",
          },
        };
      case "ApprovedExpense":
        return {
          status,
          body: {
            ...shared,
            state: "approved",
            reviewerId: expense.reviewerId,
          },
        };
      case "RejectedExpense":
        return {
          status,
          body: {
            ...shared,
            state: "rejected",
            reviewerId: expense.reviewerId,
            reason: expense.reason,
          },
        };
      case "PaidExpense":
        return {
          status,
          body: {
            ...shared,
            state: "paid",
            reviewerId: expense.reviewerId,
            receiptId: expense.receiptId,
          },
        };
      default:
        return assertNever(expense);
    }
  },

  error: (status: ErrorStatus, code: string): ApiResponse => ({
    status,
    body: { code },
  }),
} as const;

