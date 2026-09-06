import type { Expense } from "./expense";

type PublicDraft = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "draft";
}>;

type PublicSubmitted = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "submitted";
}>;

type PublicApproved = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  reviewerId: string;
  state: "approved";
}>;

type PublicRejected = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  reviewerId: string;
  reason: string;
  state: "rejected";
}>;

type PublicPaid = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  reviewerId: string;
  receiptId: string;
  state: "paid";
}>;

export type PublicExpense = PublicDraft | PublicSubmitted | PublicApproved | PublicRejected | PublicPaid;

export const PublicExpense = {
  fromExpense: (expense: Expense): PublicExpense => {
    switch (expense.kind) {
      case "draft":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: expense.kind,
        };
      case "submitted":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: expense.kind,
        };
      case "approved":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          reviewerId: expense.reviewerId,
          state: expense.kind,
        };
      case "rejected":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
          state: expense.kind,
        };
      case "paid":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
          state: expense.kind,
        };
    }
  },
} as const;
