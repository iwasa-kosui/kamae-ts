import type { EmailAddress, EmployeeId, ExpenseId } from "./validation";
import { isEmailAddress, toEmailAddress, toEmployeeId, toExpenseId } from "./validation";

export type ExpenseState = "draft" | "submitted" | "approved" | "rejected" | "paid";

export type DraftExpense = Readonly<{
  kind: "draft";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

export type SubmittedExpense = Readonly<{
  kind: "submitted";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

export type ApprovedExpense = Readonly<{
  kind: "approved";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
  reviewerId: EmployeeId;
}>;

export type RejectedExpense = Readonly<{
  kind: "rejected";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
  reviewerId: EmployeeId;
  reason: string;
}>;

export type PaidExpense = Readonly<{
  kind: "paid";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
  reviewerId: EmployeeId;
  receiptId: string;
}>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export type ExpenseBody = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: ExpenseState;
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type ExpenseEvent =
  | Readonly<{ kind: "expense.created"; expenseId: string }>
  | Readonly<{ kind: "expense.submitted"; expenseId: string }>
  | Readonly<{ kind: "expense.approved"; expenseId: string }>
  | Readonly<{ kind: "expense.rejected"; expenseId: string }>
  | Readonly<{ kind: "expense.paid"; expenseId: string }>;

type ParseSuccess<T> = Readonly<{
  ok: true;
  value: T;
}>;

type ParseFailure = Readonly<{
  ok: false;
}>;

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const invalid = (): ParseFailure => ({ ok: false });

const success = <T>(value: T): ParseSuccess<T> => ({ ok: true, value });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isExpenseState = (value: unknown): value is ExpenseState =>
  value === "draft" ||
  value === "submitted" ||
  value === "approved" ||
  value === "rejected" ||
  value === "paid";

const isAmountCents = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 1_000_000;

export const parseExpense = (raw: unknown): ParseResult<Expense> => {
  if (!isPlainObject(raw)) return invalid();
  if (!isExpenseState(raw.kind)) return invalid();
  if (!isNonEmptyString(raw.id)) return invalid();
  if (!isNonEmptyString(raw.ownerId)) return invalid();
  if (!isEmailAddress(raw.ownerEmail)) return invalid();
  if (!isNonEmptyString(raw.description)) return invalid();
  if (!isAmountCents(raw.amountCents)) return invalid();

  const id = toExpenseId(raw.id);
  const ownerId = toEmployeeId(raw.ownerId);
  const ownerEmail = toEmailAddress(raw.ownerEmail);
  const description = raw.description.trim();
  const amountCents = raw.amountCents;

  switch (raw.kind) {
    case "draft":
      return success({
        kind: "draft",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
      });
    case "submitted":
      return success({
        kind: "submitted",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
      });
    case "approved":
      if (!isNonEmptyString(raw.reviewerId)) return invalid();
      return success({
        kind: "approved",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
        reviewerId: toEmployeeId(raw.reviewerId),
      });
    case "rejected":
      if (!isNonEmptyString(raw.reviewerId)) return invalid();
      if (!isNonEmptyString(raw.reason)) return invalid();
      return success({
        kind: "rejected",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
        reviewerId: toEmployeeId(raw.reviewerId),
        reason: raw.reason.trim(),
      });
    case "paid":
      if (!isNonEmptyString(raw.reviewerId)) return invalid();
      if (!isNonEmptyString(raw.receiptId)) return invalid();
      return success({
        kind: "paid",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
        reviewerId: toEmployeeId(raw.reviewerId),
        receiptId: raw.receiptId.trim(),
      });
  }
};

export const Expense = {
  create: (input: {
    id: ExpenseId;
    ownerId: EmployeeId;
    ownerEmail: EmailAddress;
    description: string;
    amountCents: number;
  }): DraftExpense => ({
    kind: "draft",
    id: input.id,
    ownerId: input.ownerId,
    ownerEmail: input.ownerEmail,
    description: input.description,
    amountCents: input.amountCents,
  }),
  submit: (expense: DraftExpense): SubmittedExpense => ({
    kind: "submitted",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
  }),
  approve: (expense: SubmittedExpense, reviewerId: EmployeeId): ApprovedExpense => ({
    kind: "approved",
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
    reason: string,
  ): RejectedExpense => ({
    kind: "rejected",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId,
    reason,
  }),
  pay: (expense: ApprovedExpense, receiptId: string): PaidExpense => ({
    kind: "paid",
    id: expense.id,
    ownerId: expense.ownerId,
    ownerEmail: expense.ownerEmail,
    description: expense.description,
    amountCents: expense.amountCents,
    reviewerId: expense.reviewerId,
    receiptId,
  }),
  toBody: (expense: Expense): ExpenseBody => {
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
  event: {
    created: (expenseId: string): ExpenseEvent => ({
      kind: "expense.created",
      expenseId,
    }),
    submitted: (expenseId: string): ExpenseEvent => ({
      kind: "expense.submitted",
      expenseId,
    }),
    approved: (expenseId: string): ExpenseEvent => ({
      kind: "expense.approved",
      expenseId,
    }),
    rejected: (expenseId: string): ExpenseEvent => ({
      kind: "expense.rejected",
      expenseId,
    }),
    paid: (expenseId: string): ExpenseEvent => ({
      kind: "expense.paid",
      expenseId,
    }),
  } as const,
} as const;

export const assertNever = (value: never): never => {
  throw new Error(`Unhandled case: ${String(value)}`);
};

export const isSubmittedExpense = (expense: Expense): expense is SubmittedExpense =>
  expense.kind === "submitted";

export const isDraftExpense = (expense: Expense): expense is DraftExpense =>
  expense.kind === "draft";

export const isApprovedExpense = (expense: Expense): expense is ApprovedExpense =>
  expense.kind === "approved";

export const isPaidExpense = (expense: Expense): expense is PaidExpense =>
  expense.kind === "paid";
