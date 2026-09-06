import { assertNever } from "../result";
import type {
  AmountCents,
  Description,
  EmployeeId,
  ExpenseId,
  OwnerEmail,
  RejectionReason,
} from "./value-objects";

export type DraftExpense = Readonly<{
  kind: "Draft";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: OwnerEmail;
  description: Description;
  amountCents: AmountCents;
}>;

export type SubmittedExpense = Readonly<{
  kind: "Submitted";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: OwnerEmail;
  description: Description;
  amountCents: AmountCents;
}>;

export type ApprovedExpense = Readonly<{
  kind: "Approved";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: OwnerEmail;
  description: Description;
  amountCents: AmountCents;
  reviewerId: EmployeeId;
}>;

export type RejectedExpense = Readonly<{
  kind: "Rejected";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: OwnerEmail;
  description: Description;
  amountCents: AmountCents;
  reviewerId: EmployeeId;
  reason: RejectionReason;
}>;

export type PaidExpense = Readonly<{
  kind: "Paid";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: OwnerEmail;
  description: Description;
  amountCents: AmountCents;
  reviewerId: EmployeeId;
  receiptId: string;
}>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export type PublicExpense = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export const Expense = {
  create: (
    id: ExpenseId,
    ownerId: EmployeeId,
    ownerEmail: OwnerEmail,
    description: Description,
    amountCents: AmountCents,
  ): DraftExpense => ({
    kind: "Draft",
    id,
    ownerId,
    ownerEmail,
    description,
    amountCents,
  }),

  submit: (draft: DraftExpense): SubmittedExpense => ({
    kind: "Submitted",
    id: draft.id,
    ownerId: draft.ownerId,
    ownerEmail: draft.ownerEmail,
    description: draft.description,
    amountCents: draft.amountCents,
  }),

  approve: (
    submitted: SubmittedExpense,
    reviewerId: EmployeeId,
  ): ApprovedExpense => ({
    kind: "Approved",
    id: submitted.id,
    ownerId: submitted.ownerId,
    ownerEmail: submitted.ownerEmail,
    description: submitted.description,
    amountCents: submitted.amountCents,
    reviewerId,
  }),

  reject: (
    submitted: SubmittedExpense,
    reviewerId: EmployeeId,
    reason: RejectionReason,
  ): RejectedExpense => ({
    kind: "Rejected",
    id: submitted.id,
    ownerId: submitted.ownerId,
    ownerEmail: submitted.ownerEmail,
    description: submitted.description,
    amountCents: submitted.amountCents,
    reviewerId,
    reason,
  }),

  markPaid: (approved: ApprovedExpense, receiptId: string): PaidExpense => ({
    kind: "Paid",
    id: approved.id,
    ownerId: approved.ownerId,
    ownerEmail: approved.ownerEmail,
    description: approved.description,
    amountCents: approved.amountCents,
    reviewerId: approved.reviewerId,
    receiptId,
  }),

  toPublic: (expense: Expense): PublicExpense => {
    switch (expense.kind) {
      case "Draft":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: "draft",
        };
      case "Submitted":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: "submitted",
        };
      case "Approved":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: "approved",
          reviewerId: expense.reviewerId,
        };
      case "Rejected":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: "rejected",
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "Paid":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: "paid",
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
      default:
        return assertNever(expense);
    }
  },
} as const;
