import { EmailAddress } from "./email-address";
import { EmployeeId } from "./employee-id";
import { ExpenseId } from "./expense-id";

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
  receiptId: string;
}>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export type ReviewableExpense = SubmittedExpense;
export type PayableExpense = ApprovedExpense | PaidExpense;

type RawRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isExpenseKind = (value: unknown): value is Expense["kind"] =>
  value === "draft" || value === "submitted" || value === "approved" || value === "rejected" || value === "paid";

const parseStoredCommon = (raw: RawRecord) => {
  const id = ExpenseId.parse(raw.id);
  const ownerId = EmployeeId.parse(raw.ownerId);
  const ownerEmail = EmailAddress.parse(raw.ownerEmail);
  const description = typeof raw.description === "string" ? raw.description : undefined;
  const amountCents = typeof raw.amountCents === "number" && Number.isInteger(raw.amountCents) ? raw.amountCents : undefined;

  if (id === undefined || ownerId === undefined || ownerEmail === undefined || description === undefined || amountCents === undefined) {
    return undefined;
  }

  return {
    id,
    ownerId,
    ownerEmail,
    description,
    amountCents,
  };
};

const createBaseExpense = (
  id: ExpenseId,
  ownerId: EmployeeId,
  ownerEmail: EmailAddress,
  description: string,
  amountCents: number,
): Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}> => ({
  id,
  ownerId,
  ownerEmail,
  description,
  amountCents,
});

export const Expense = {
  create: (
    id: ExpenseId,
    ownerId: EmployeeId,
    ownerEmail: EmailAddress,
    description: string,
    amountCents: number,
  ): DraftExpense => ({
    kind: "draft",
    ...createBaseExpense(id, ownerId, ownerEmail, description, amountCents),
  }),

  submit: (expense: DraftExpense): SubmittedExpense => ({
    kind: "submitted",
    ...createBaseExpense(
      expense.id,
      expense.ownerId,
      expense.ownerEmail,
      expense.description,
      expense.amountCents,
    ),
  }),

  approve: (expense: SubmittedExpense): ApprovedExpense => ({
    kind: "approved",
    ...createBaseExpense(
      expense.id,
      expense.ownerId,
      expense.ownerEmail,
      expense.description,
      expense.amountCents,
    ),
  }),

  reject: (expense: SubmittedExpense, reviewerId: EmployeeId, reason: string): RejectedExpense => ({
    kind: "rejected",
    ...createBaseExpense(
      expense.id,
      expense.ownerId,
      expense.ownerEmail,
      expense.description,
      expense.amountCents,
    ),
    reviewerId,
    reason,
  }),

  pay: (expense: ApprovedExpense, receiptId: string): PaidExpense => ({
    kind: "paid",
    ...createBaseExpense(
      expense.id,
      expense.ownerId,
      expense.ownerEmail,
      expense.description,
      expense.amountCents,
    ),
    receiptId,
  }),

  isDraft: (expense: Expense) => expense.kind === "draft",
  isSubmitted: (expense: Expense) => expense.kind === "submitted",
  isApproved: (expense: Expense) => expense.kind === "approved",
  isRejected: (expense: Expense) => expense.kind === "rejected",
  isPaid: (expense: Expense) => expense.kind === "paid",

  parseStored: (raw: unknown): Expense | undefined => {
    if (!isRecord(raw) || !isExpenseKind(raw.kind)) return undefined;
    const common = parseStoredCommon(raw);
    if (common === undefined) return undefined;

    if (raw.kind === "rejected") {
      const reviewerId = EmployeeId.parse(raw.reviewerId);
      if (reviewerId === undefined || typeof raw.reason !== "string") return undefined;
      return {
        kind: "rejected",
        ...common,
        reviewerId,
        reason: raw.reason,
      };
    }

    if (raw.kind === "paid") {
      if (typeof raw.receiptId !== "string" || raw.receiptId.length === 0) return undefined;
      return {
        kind: "paid",
        ...common,
        receiptId: raw.receiptId,
      };
    }

    if (raw.kind === "draft") {
      return { kind: "draft", ...common };
    }

    if (raw.kind === "submitted") {
      return { kind: "submitted", ...common };
    }

    return { kind: "approved", ...common };
  },
} as const;
