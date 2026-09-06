import { EmployeeId, type EmployeeId as EmployeeIdType } from "./employee-id";
import { ExpenseId, type ExpenseId as ExpenseIdType } from "./expense-id";

export type ExpenseDraft = Readonly<{
  kind: "draft";
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  ownerEmail: string;
  description: string;
  amountCents: number;
}>;

export type ExpenseSubmitted = Readonly<{
  kind: "submitted";
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  ownerEmail: string;
  description: string;
  amountCents: number;
}>;

export type ExpenseApproved = Readonly<{
  kind: "approved";
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  ownerEmail: string;
  description: string;
  amountCents: number;
  reviewerId: EmployeeIdType;
}>;

export type ExpenseRejected = Readonly<{
  kind: "rejected";
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  ownerEmail: string;
  description: string;
  amountCents: number;
  reviewerId: EmployeeIdType;
  reason: string;
}>;

export type ExpensePaid = Readonly<{
  kind: "paid";
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  ownerEmail: string;
  description: string;
  amountCents: number;
  reviewerId?: EmployeeIdType;
  receiptId: string;
}>;

export type Expense = ExpenseDraft | ExpenseSubmitted | ExpenseApproved | ExpenseRejected | ExpensePaid;

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

const create = (
  id: ExpenseIdType,
  ownerId: EmployeeIdType,
  ownerEmail: string,
  description: string,
  amountCents: number,
): ExpenseDraft => ({
  kind: "draft",
  id,
  ownerId,
  ownerEmail,
  description,
  amountCents,
});

const submit = (expense: ExpenseDraft): ExpenseSubmitted => ({
  kind: "submitted",
  id: expense.id,
  ownerId: expense.ownerId,
  ownerEmail: expense.ownerEmail,
  description: expense.description,
  amountCents: expense.amountCents,
});

const approve = (expense: ExpenseSubmitted, reviewerId: EmployeeIdType): ExpenseApproved => ({
  kind: "approved",
  id: expense.id,
  ownerId: expense.ownerId,
  ownerEmail: expense.ownerEmail,
  description: expense.description,
  amountCents: expense.amountCents,
  reviewerId,
});

const reject = (
  expense: ExpenseSubmitted,
  reviewerId: EmployeeIdType,
  reason: string,
): ExpenseRejected => ({
  kind: "rejected",
  id: expense.id,
  ownerId: expense.ownerId,
  ownerEmail: expense.ownerEmail,
  description: expense.description,
  amountCents: expense.amountCents,
  reviewerId,
  reason,
});

const markPaid = (expense: ExpenseApproved, receiptId: string): ExpensePaid => ({
  kind: "paid",
  id: expense.id,
  ownerId: expense.ownerId,
  ownerEmail: expense.ownerEmail,
  description: expense.description,
  amountCents: expense.amountCents,
  reviewerId: expense.reviewerId,
  receiptId,
});

const toView = (expense: Expense): ExpenseView => ({
  id: expense.id,
  ownerId: expense.ownerId,
  description: expense.description,
  amountCents: expense.amountCents,
  state: expense.kind,
  ...("reviewerId" in expense ? { reviewerId: expense.reviewerId } : {}),
  ...("reason" in expense ? { reason: expense.reason } : {}),
  ...("receiptId" in expense ? { receiptId: expense.receiptId } : {}),
});

export const Expense = {
  create,
  submit,
  approve,
  reject,
  markPaid,
  toView,
  isDraft: (expense: Expense): expense is ExpenseDraft => expense.kind === "draft",
  isSubmitted: (expense: Expense): expense is ExpenseSubmitted => expense.kind === "submitted",
  isApproved: (expense: Expense): expense is ExpenseApproved => expense.kind === "approved",
  isRejected: (expense: Expense): expense is ExpenseRejected => expense.kind === "rejected",
  isPaid: (expense: Expense): expense is ExpensePaid => expense.kind === "paid",
} as const;
