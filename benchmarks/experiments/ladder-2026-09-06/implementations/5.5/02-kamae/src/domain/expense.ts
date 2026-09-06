import type { AmountCents } from "./amount-cents";
import type { EmployeeId } from "./employee-id";
import type { ExpenseDescription } from "./expense-description";
import type { ExpenseId } from "./expense-id";
import type { OwnerEmail } from "./owner-email";
import type { ReceiptId } from "./receipt-id";
import type { RejectionReason } from "./rejection-reason";
import type { Sensitive } from "./sensitive";

type ExpenseBase<TKind extends string> = Readonly<{
  kind: TKind;
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: Sensitive<OwnerEmail>;
  description: ExpenseDescription;
  amountCents: AmountCents;
}>;

export type DraftExpense = ExpenseBase<"DraftExpense">;
export type SubmittedExpense = ExpenseBase<"SubmittedExpense">;
export type ApprovedExpense = ExpenseBase<"ApprovedExpense"> &
  Readonly<{ reviewerId: EmployeeId }>;
export type RejectedExpense = ExpenseBase<"RejectedExpense"> &
  Readonly<{ reviewerId: EmployeeId; reason: RejectionReason }>;
export type PaidExpense = ExpenseBase<"PaidExpense"> &
  Readonly<{ reviewerId: EmployeeId; receiptId: ReceiptId }>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export const Expense = {
  create: (values: Omit<DraftExpense, "kind">): DraftExpense => ({
    kind: "DraftExpense",
    ...values,
  }),

  submit: (expense: DraftExpense): SubmittedExpense => ({
    kind: "SubmittedExpense",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
  }),

  approve: (expense: SubmittedExpense, reviewerId: EmployeeId): ApprovedExpense => ({
    kind: "ApprovedExpense",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId,
  }),

  reject: (
    expense: SubmittedExpense,
    reviewerId: EmployeeId,
    reason: RejectionReason,
  ): RejectedExpense => ({
    kind: "RejectedExpense",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId,
    reason,
  }),

  markPaid: (expense: ApprovedExpense, receiptId: ReceiptId): PaidExpense => ({
    kind: "PaidExpense",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId: expense.reviewerId,
    receiptId,
  }),
} as const;
