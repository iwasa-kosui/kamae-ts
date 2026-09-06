import { Expense, Sensitive, type Email, type Expense as ExpenseEntity } from "../domain/expense";

export type CreateCommand = Readonly<{
  op: "create";
  id: string;
  ownerId: string;
  ownerEmail: string;
  description: string;
  amountCents: number;
}>;

export type SubmitCommand = Readonly<{
  op: "submit";
  id: string;
  actorId: string;
}>;

export type ApproveCommand = Readonly<{
  op: "approve";
  id: string;
  actorId: string;
}>;

export type RejectCommand = Readonly<{
  op: "reject";
  id: string;
  actorId: string;
  reason: string;
}>;

export type PayCommand = Readonly<{ op: "pay"; id: string }>;
export type GetCommand = Readonly<{ op: "get"; id: string }>;

export type Command =
  | CreateCommand
  | SubmitCommand
  | ApproveCommand
  | RejectCommand
  | PayCommand
  | GetCommand;

export type StoredExpense = Readonly<{
  kind: "draft" | "submitted" | "approved" | "rejected" | "paid";
  id: string;
  ownerId: string;
  ownerEmail: string;
  description: string;
  amountCents: number;
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type ParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false }>;

const ok = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const invalid = <T>(): ParseResult<T> => ({ ok: false });

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonemptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNonblankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidEmail = (value: unknown): value is Email =>
  typeof value === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 1_000_000;

export const Command = {
  parse: (raw: unknown): ParseResult<Command> => {
    if (!isRecord(raw) || typeof raw.op !== "string") return invalid();

    switch (raw.op) {
      case "create":
        if (
          isNonemptyString(raw.id) &&
          isNonemptyString(raw.ownerId) &&
          isValidEmail(raw.ownerEmail) &&
          isNonblankString(raw.description) &&
          isValidAmount(raw.amountCents)
        ) {
          return ok({
            op: "create",
            id: raw.id,
            ownerId: raw.ownerId,
            ownerEmail: raw.ownerEmail,
            description: raw.description,
            amountCents: raw.amountCents,
          });
        }
        return invalid();
      case "submit":
        if (isNonemptyString(raw.id) && isNonemptyString(raw.actorId)) {
          return ok({ op: "submit", id: raw.id, actorId: raw.actorId });
        }
        return invalid();
      case "approve":
        if (isNonemptyString(raw.id) && isNonemptyString(raw.actorId)) {
          return ok({ op: "approve", id: raw.id, actorId: raw.actorId });
        }
        return invalid();
      case "reject":
        if (
          isNonemptyString(raw.id) &&
          isNonemptyString(raw.actorId) &&
          isNonblankString(raw.reason)
        ) {
          return ok({
            op: "reject",
            id: raw.id,
            actorId: raw.actorId,
            reason: raw.reason,
          });
        }
        return invalid();
      case "pay":
        if (isNonemptyString(raw.id)) return ok({ op: "pay", id: raw.id });
        return invalid();
      case "get":
        if (isNonemptyString(raw.id)) return ok({ op: "get", id: raw.id });
        return invalid();
      default:
        return invalid();
    }
  },
} as const;

export const StoredExpense = {
  parse: (raw: unknown): ParseResult<ExpenseEntity> => {
    if (
      !isRecord(raw) ||
      !isNonemptyString(raw.id) ||
      !isNonemptyString(raw.ownerId) ||
      !isValidEmail(raw.ownerEmail) ||
      !isNonblankString(raw.description) ||
      !isValidAmount(raw.amountCents)
    ) {
      return invalid();
    }

    const fields = {
      id: raw.id,
      ownerId: raw.ownerId,
      ownerEmail: Sensitive.of(raw.ownerEmail),
      description: raw.description,
      amountCents: raw.amountCents,
    };

    switch (raw.kind) {
      case "draft":
        return ok(Expense.createDraft(fields));
      case "submitted":
        return ok(Expense.submit(Expense.createDraft(fields)));
      case "approved":
        if (!isNonemptyString(raw.reviewerId)) return invalid();
        return ok(Expense.approve(Expense.submit(Expense.createDraft(fields)), raw.reviewerId));
      case "rejected":
        if (!isNonemptyString(raw.reviewerId) || !isNonblankString(raw.reason)) {
          return invalid();
        }
        return ok(
          Expense.reject(
            Expense.submit(Expense.createDraft(fields)),
            raw.reviewerId,
            raw.reason,
          ),
        );
      case "paid":
        if (!isNonemptyString(raw.reviewerId) || !isNonemptyString(raw.receiptId)) {
          return invalid();
        }
        return ok(
          Expense.markPaid(
            Expense.approve(Expense.submit(Expense.createDraft(fields)), raw.reviewerId),
            raw.receiptId,
          ),
        );
      default:
        return invalid();
    }
  },

  fromDomain: (expense: ExpenseEntity): StoredExpense => {
    const common = {
      id: expense.id,
      ownerId: expense.ownerId,
      ownerEmail: expense.ownerEmail.unwrap(),
      description: expense.description,
      amountCents: expense.amountCents,
      kind: expense.kind,
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
