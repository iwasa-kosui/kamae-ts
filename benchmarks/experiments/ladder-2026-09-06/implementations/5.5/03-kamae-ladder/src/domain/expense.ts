export type ExpenseId = string;
export type EmployeeId = string;
export type Email = string;

export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
  }),
} as const;

type ExpenseFields = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: Sensitive<Email>;
  description: string;
  amountCents: number;
}>;

export type DraftExpense = ExpenseFields & Readonly<{ kind: "draft" }>;
export type SubmittedExpense = ExpenseFields & Readonly<{ kind: "submitted" }>;
export type ApprovedExpense = ExpenseFields &
  Readonly<{ kind: "approved"; reviewerId: EmployeeId }>;
export type RejectedExpense = ExpenseFields &
  Readonly<{ kind: "rejected"; reviewerId: EmployeeId; reason: string }>;
export type PaidExpense = ExpenseFields &
  Readonly<{ kind: "paid"; reviewerId: EmployeeId; receiptId: string }>;

export type Expense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export type ExpenseResponseBody = Readonly<{
  id: ExpenseId;
  ownerId: EmployeeId;
  description: string;
  amountCents: number;
  state: Expense["kind"];
  reviewerId?: EmployeeId;
  reason?: string;
  receiptId?: string;
}>;

export const Expense = {
  createDraft: (input: ExpenseFields): DraftExpense => ({
    ...input,
    kind: "draft",
  }),

  submit: (expense: DraftExpense): SubmittedExpense => ({
    ...expense,
    kind: "submitted",
  }),

  approve: (
    expense: SubmittedExpense,
    reviewerId: EmployeeId,
  ): ApprovedExpense => ({
    ...expense,
    kind: "approved",
    reviewerId,
  }),

  reject: (
    expense: SubmittedExpense,
    reviewerId: EmployeeId,
    reason: string,
  ): RejectedExpense => ({
    ...expense,
    kind: "rejected",
    reviewerId,
    reason,
  }),

  markPaid: (expense: ApprovedExpense, receiptId: string): PaidExpense => ({
    ...expense,
    kind: "paid",
    receiptId,
  }),

  toResponseBody: (expense: Expense): ExpenseResponseBody => {
    const common = {
      id: expense.id,
      ownerId: expense.ownerId,
      description: expense.description,
      amountCents: expense.amountCents,
      state: expense.kind,
    } as const;

    switch (expense.kind) {
      case "draft":
      case "submitted":
        return common;
      case "approved":
        return { ...common, reviewerId: expense.reviewerId };
      case "rejected":
        return {
          ...common,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "paid":
        return {
          ...common,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
    }
  },
} as const;
