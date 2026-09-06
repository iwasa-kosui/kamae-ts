import type { EmailAddress } from "./email-address";
import type { EmployeeId } from "./employee-id";
import type { ExpenseId } from "./expense-id";
import type { ReceiptId } from "./receipt-id";

type Draft = Readonly<{
  kind: "draft";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

type Submitted = Readonly<{
  kind: "submitted";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

type Approved = Readonly<{
  kind: "approved";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
  reviewerId: EmployeeId;
}>;

type Rejected = Readonly<{
  kind: "rejected";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
  reviewerId: EmployeeId;
  reason: string;
}>;

type Paid = Readonly<{
  kind: "paid";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
  reviewerId: EmployeeId;
  receiptId: ReceiptId;
}>;

export type Expense = Draft | Submitted | Approved | Rejected | Paid;

type NewExpense = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

const isDraft = (expense: Expense) => expense.kind === "draft";
const isSubmitted = (expense: Expense) => expense.kind === "submitted";
const isApproved = (expense: Expense) => expense.kind === "approved";
const isRejected = (expense: Expense) => expense.kind === "rejected";
const isPaid = (expense: Expense) => expense.kind === "paid";

export const Expense = {
  create: (input: NewExpense): Draft => ({
    kind: "draft",
    id: input.id,
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail,
    description: input.description,
    amountCents: input.amountCents,
  }),
  submit: (expense: Draft): Submitted => ({
    kind: "submitted",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
  }),
  approve: (expense: Submitted, reviewerId: EmployeeId): Approved => ({
    kind: "approved",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId,
  }),
  reject: (expense: Submitted, reviewerId: EmployeeId, reason: string): Rejected => ({
    kind: "rejected",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId,
    reason,
  }),
  markPaid: (expense: Approved, receiptId: ReceiptId): Paid => ({
    kind: "paid",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId: expense.reviewerId,
    receiptId,
  }),
  isDraft,
  isSubmitted,
  isApproved,
  isRejected,
  isPaid,
} as const;
