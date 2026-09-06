import type { AmountCents } from "./amount-cents";
import type { Description } from "./description";
import type { EmployeeId } from "./employee-id";
import type { ExpenseId } from "./expense-id";
import type { OwnerEmail } from "./owner-email";
import type { ReceiptId } from "./receipt-id";
import type { RejectionReason } from "./rejection-reason";
import type { Sensitive } from "./sensitive";

type BaseExpense = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: Sensitive<OwnerEmail>;
  description: Description;
  amountCents: AmountCents;
}>;

export type DraftExpense = BaseExpense & Readonly<{ kind: "draft" }>;
export type SubmittedExpense = BaseExpense & Readonly<{ kind: "submitted" }>;
export type ApprovedExpense = BaseExpense & Readonly<{ kind: "approved"; reviewerId: EmployeeId }>;
export type RejectedExpense = BaseExpense & Readonly<{ kind: "rejected"; reviewerId: EmployeeId; reason: RejectionReason }>;
export type PaidExpense = BaseExpense & Readonly<{ kind: "paid"; reviewerId: EmployeeId; receiptId: ReceiptId }>;

export type Expense = DraftExpense | SubmittedExpense | ApprovedExpense | RejectedExpense | PaidExpense;

export type TransitionError =
  | Readonly<{ kind: "unauthorized_submit" }>
  | Readonly<{ kind: "self_review" }>
  | Readonly<{ kind: "invalid_state" }>;

export type ExpenseView = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: Expense["kind"];
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export const Expense = {
  createDraft: (
    id: ExpenseId,
    ownerId: EmployeeId,
    ownerEmail: Sensitive<OwnerEmail>,
    description: Description,
    amountCents: AmountCents,
  ): DraftExpense => ({
    kind: "draft",
    id,
    ownerId,
    ownerEmail,
    description,
    amountCents,
  }),

  submit: (expense: Expense, actorId: EmployeeId): SubmittedExpense | TransitionError => {
    if (expense.ownerId !== actorId) return { kind: "unauthorized_submit" };
    if (expense.kind !== "draft") return { kind: "invalid_state" };
    return { ...expense, kind: "submitted" };
  },

  approve: (expense: Expense, actorId: EmployeeId): ApprovedExpense | TransitionError => {
    if (expense.ownerId === actorId) return { kind: "self_review" };
    if (expense.kind !== "submitted") return { kind: "invalid_state" };
    return { ...expense, kind: "approved", reviewerId: actorId };
  },

  reject: (expense: Expense, actorId: EmployeeId, reason: RejectionReason): RejectedExpense | TransitionError => {
    if (expense.ownerId === actorId) return { kind: "self_review" };
    if (expense.kind !== "submitted") return { kind: "invalid_state" };
    return { ...expense, kind: "rejected", reviewerId: actorId, reason };
  },

  pay: (expense: ApprovedExpense, receiptId: ReceiptId): PaidExpense => ({
    ...expense,
    kind: "paid",
    receiptId,
  }),

  toView: (expense: Expense): ExpenseView => {
    switch (expense.kind) {
      case "draft":
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
          state: expense.kind,
          reviewerId: expense.reviewerId,
        };
      case "rejected":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: expense.kind,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "paid":
        return {
          id: expense.id,
          ownerId: expense.ownerId,
          description: expense.description,
          amountCents: expense.amountCents,
          state: expense.kind,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
    }
  },
} as const;
