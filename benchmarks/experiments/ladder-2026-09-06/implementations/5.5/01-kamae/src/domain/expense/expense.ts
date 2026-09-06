import { err, ok, type Result } from "neverthrow";
import type { AmountCents } from "./amount-cents";
import type { Description } from "./description";
import type { EmployeeId } from "./employee-id";
import type { ExpenseId } from "./expense-id";
import type { SensitiveOwnerEmail } from "./owner-email";
import type { ReceiptId } from "./receipt-id";
import type { RejectionReason } from "./rejection-reason";

export type DraftExpense = Readonly<{
  kind: "Draft";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveOwnerEmail;
  description: Description;
  amountCents: AmountCents;
}>;

export type SubmittedExpense = Readonly<{
  kind: "Submitted";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveOwnerEmail;
  description: Description;
  amountCents: AmountCents;
}>;

export type ApprovedExpense = Readonly<{
  kind: "Approved";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveOwnerEmail;
  description: Description;
  amountCents: AmountCents;
  reviewerId: EmployeeId;
}>;

export type RejectedExpense = Readonly<{
  kind: "Rejected";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveOwnerEmail;
  description: Description;
  amountCents: AmountCents;
  reviewerId: EmployeeId;
  reason: RejectionReason;
}>;

export type PaidExpense = Readonly<{
  kind: "Paid";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveOwnerEmail;
  description: Description;
  amountCents: AmountCents;
  reviewerId: EmployeeId;
  receiptId: ReceiptId;
}>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

type CreateExpenseInput = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: SensitiveOwnerEmail;
  description: Description;
  amountCents: AmountCents;
}>;

export type UnauthorizedSubmit = Readonly<{ kind: "UnauthorizedSubmit" }>;
export type SelfReview = Readonly<{ kind: "SelfReview" }>;

export const Expense = {
  create: (input: CreateExpenseInput): DraftExpense => ({
    kind: "Draft",
    id: input.id,
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail,
    description: input.description,
    amountCents: input.amountCents,
  }),

  submit: (
    draft: DraftExpense,
    actorId: EmployeeId,
  ): Result<SubmittedExpense, UnauthorizedSubmit> =>
    draft.ownerId === actorId
      ? ok({
          kind: "Submitted",
          id: draft.id,
          ownerId: draft.ownerId,
          ownerEmail: draft.ownerEmail,
          description: draft.description,
          amountCents: draft.amountCents,
        })
      : err({ kind: "UnauthorizedSubmit" }),

  approve: (
    submitted: SubmittedExpense,
    actorId: EmployeeId,
  ): Result<ApprovedExpense, SelfReview> =>
    submitted.ownerId !== actorId
      ? ok({
          kind: "Approved",
          id: submitted.id,
          ownerId: submitted.ownerId,
          ownerEmail: submitted.ownerEmail,
          description: submitted.description,
          amountCents: submitted.amountCents,
          reviewerId: actorId,
        })
      : err({ kind: "SelfReview" }),

  reject: (
    submitted: SubmittedExpense,
    actorId: EmployeeId,
    reason: RejectionReason,
  ): Result<RejectedExpense, SelfReview> =>
    submitted.ownerId !== actorId
      ? ok({
          kind: "Rejected",
          id: submitted.id,
          ownerId: submitted.ownerId,
          ownerEmail: submitted.ownerEmail,
          description: submitted.description,
          amountCents: submitted.amountCents,
          reviewerId: actorId,
          reason,
        })
      : err({ kind: "SelfReview" }),

  markPaid: (approved: ApprovedExpense, receiptId: ReceiptId): PaidExpense => ({
    kind: "Paid",
    id: approved.id,
    ownerId: approved.ownerId,
    ownerEmail: approved.ownerEmail,
    description: approved.description,
    amountCents: approved.amountCents,
    reviewerId: approved.reviewerId,
    receiptId,
  }),
} as const;
