export type ExpenseKind = "draft" | "submitted" | "approved" | "rejected" | "paid";

type ExpenseBase = Readonly<{
  id: string;
  ownerId: string;
  ownerEmail: string;
  description: string;
  amountCents: number;
}>;

export type DraftExpense = ExpenseBase &
  Readonly<{
    kind: "draft";
  }>;

export type SubmittedExpense = ExpenseBase &
  Readonly<{
    kind: "submitted";
    submittedBy: string;
  }>;

export type ApprovedExpense = ExpenseBase &
  Readonly<{
    kind: "approved";
    submittedBy: string;
    reviewerId: string;
  }>;

export type RejectedExpense = ExpenseBase &
  Readonly<{
    kind: "rejected";
    submittedBy: string;
    reviewerId: string;
    reason: string;
  }>;

export type PaidExpense = ExpenseBase &
  Readonly<{
    kind: "paid";
    submittedBy: string;
    reviewerId: string;
    receiptId: string;
  }>;

type StoredExpense =
  | DraftExpense
  | SubmittedExpense
  | ApprovedExpense
  | RejectedExpense
  | PaidExpense;

export type Expense = StoredExpense;

export type ExpenseBody = Readonly<{
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  state: ExpenseKind;
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type ExpenseAction = "create" | "submit" | "approve" | "reject" | "pay";

export type ExpenseDiagnosticEvent = Readonly<{
  kind: "expense_action";
  expenseId: string;
  action: ExpenseAction;
}>;

export type PaymentResult =
  | Readonly<{
      kind: "paid";
      receiptId: string;
    }>
  | Readonly<{
      kind: "declined";
    }>;

type ExpenseRecord = StoredExpense;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function readString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readExpenseBase(raw: Record<string, unknown>): ExpenseBase | undefined {
  const id = readString(raw.id);
  const ownerId = readString(raw.ownerId);
  const ownerEmail = readString(raw.ownerEmail);
  const description = readString(raw.description);
  const amountCents = raw.amountCents;

  if (
    id === undefined ||
    ownerId === undefined ||
    ownerEmail === undefined ||
    description === undefined ||
    id.length === 0 ||
    ownerId.length === 0 ||
    ownerEmail.trim().length === 0 ||
    !hasText(description) ||
    !isFiniteIntegerInRange(amountCents, 1, 1_000_000)
  ) {
    return undefined;
  }

  return {
    id,
    ownerId,
    ownerEmail,
    description,
    amountCents,
  };
}

function readExpenseRecord(value: unknown): ExpenseRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const kind = readString(value.kind);
  const base = readExpenseBase(value);
  if (kind === undefined || base === undefined) {
    return undefined;
  }

  switch (kind) {
    case "draft":
      return { ...base, kind };
    case "submitted": {
      const submittedBy = readString(value.submittedBy);
      return submittedBy === undefined || submittedBy.length === 0
        ? undefined
        : { ...base, kind, submittedBy };
    }
    case "approved": {
      const submittedBy = readString(value.submittedBy);
      const reviewerId = readString(value.reviewerId);
      return submittedBy === undefined || submittedBy.length === 0 || reviewerId === undefined || reviewerId.length === 0
        ? undefined
        : { ...base, kind, submittedBy, reviewerId };
    }
    case "rejected": {
      const submittedBy = readString(value.submittedBy);
      const reviewerId = readString(value.reviewerId);
      const reason = readString(value.reason);
      return submittedBy === undefined ||
        submittedBy.length === 0 ||
        reviewerId === undefined ||
        reviewerId.length === 0 ||
        reason === undefined ||
        reason.trim().length === 0
        ? undefined
        : { ...base, kind, submittedBy, reviewerId, reason };
    }
    case "paid": {
      const submittedBy = readString(value.submittedBy);
      const reviewerId = readString(value.reviewerId);
      const receiptId = readString(value.receiptId);
      return submittedBy === undefined ||
        submittedBy.length === 0 ||
        reviewerId === undefined ||
        reviewerId.length === 0 ||
        receiptId === undefined ||
        receiptId.length === 0
        ? undefined
        : { ...base, kind, submittedBy, reviewerId, receiptId };
    }
    default:
      return undefined;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export const Expense = {
  createDraft(input: Readonly<ExpenseBase>): DraftExpense {
    return {
      ...input,
      kind: "draft",
    };
  },

  submit(expense: DraftExpense, submittedBy: string): SubmittedExpense {
    return {
      ...expense,
      kind: "submitted",
      submittedBy,
    };
  },

  approve(expense: SubmittedExpense, reviewerId: string): ApprovedExpense {
    return {
      ...expense,
      kind: "approved",
      reviewerId,
    };
  },

  reject(expense: SubmittedExpense, reviewerId: string, reason: string): RejectedExpense {
    return {
      ...expense,
      kind: "rejected",
      reviewerId,
      reason,
    };
  },

  pay(expense: ApprovedExpense, receiptId: string): PaidExpense {
    return {
      ...expense,
      kind: "paid",
      receiptId,
    };
  },

  fromStored(value: unknown): Expense | undefined {
    return readExpenseRecord(value);
  },

  toStored(expense: Expense): ExpenseRecord {
    switch (expense.kind) {
      case "draft":
        return expense;
      case "submitted":
        return expense;
      case "approved":
        return expense;
      case "rejected":
        return expense;
      case "paid":
        return expense;
      default:
        return assertNever(expense);
    }
  },

  toBody(expense: Expense): ExpenseBody {
    const base = {
      id: expense.id,
      ownerId: expense.ownerId,
      description: expense.description,
      amountCents: expense.amountCents,
      state: expense.kind,
    } as const;

    switch (expense.kind) {
      case "draft":
      case "submitted":
        return base;
      case "approved":
        return {
          ...base,
          reviewerId: expense.reviewerId,
        };
      case "rejected":
        return {
          ...base,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "paid":
        return {
          ...base,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
      default:
        return assertNever(expense);
    }
  },
} as const;

export type { ExpenseRecord };
