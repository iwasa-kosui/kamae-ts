import type { AmountCents } from "./amount-cents";
import type { Description } from "./description";
import type { EmailAddress } from "./email-address";
import type { EmployeeId } from "./employee-id";
import type { ExpenseId } from "./expense-id";
import type { ReceiptId } from "./receipt-id";
import type { RejectionReason } from "./rejection-reason";
import type { Sensitive } from "./sensitive";

type SharedExpense = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: Sensitive<EmailAddress>;
  description: Description;
  amountCents: AmountCents;
}>;

export type DraftExpense = SharedExpense &
  Readonly<{
    kind: "DraftExpense";
  }>;

export type SubmittedExpense = SharedExpense &
  Readonly<{
    kind: "SubmittedExpense";
  }>;

export type ApprovedExpense = SharedExpense &
  Readonly<{
    kind: "ApprovedExpense";
    reviewerId: EmployeeId;
  }>;

export type RejectedExpense = SharedExpense &
  Readonly<{
    kind: "RejectedExpense";
    reviewerId: EmployeeId;
    reason: RejectionReason;
  }>;

export type PaidExpense = SharedExpense &
  Readonly<{
    kind: "PaidExpense";
    reviewerId: EmployeeId;
    receiptId: ReceiptId;
  }>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export const Expense = {
  draft: (input: SharedExpense): DraftExpense => ({
    kind: "DraftExpense",
    id: input.id,
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail,
    description: input.description,
    amountCents: input.amountCents,
  }),

  submit: (draft: DraftExpense): SubmittedExpense => ({
    kind: "SubmittedExpense",
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
    kind: "ApprovedExpense",
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
    kind: "RejectedExpense",
    id: submitted.id,
    ownerId: submitted.ownerId,
    ownerEmail: submitted.ownerEmail,
    description: submitted.description,
    amountCents: submitted.amountCents,
    reviewerId,
    reason,
  }),

  markPaid: (approved: ApprovedExpense, receiptId: ReceiptId): PaidExpense => ({
    kind: "PaidExpense",
    id: approved.id,
    ownerId: approved.ownerId,
    ownerEmail: approved.ownerEmail,
    description: approved.description,
    amountCents: approved.amountCents,
    reviewerId: approved.reviewerId,
    receiptId,
  }),
} as const;

