import { EmailAddress } from "./email-address";
import { EmployeeId } from "./employee-id";
import { ExpenseId } from "./expense-id";

type CreateCommand = Readonly<{
  op: "create";
  id: string;
  ownerId: string;
  ownerEmail: string;
  description: string;
  amountCents: number;
}>;

type SubmitCommand = Readonly<{
  op: "submit";
  id: string;
  actorId: string;
}>;

type ApproveCommand = Readonly<{
  op: "approve";
  id: string;
  actorId: string;
}>;

type RejectCommand = Readonly<{
  op: "reject";
  id: string;
  actorId: string;
  reason: string;
}>;

type PayCommand = Readonly<{
  op: "pay";
  id: string;
}>;

type GetCommand = Readonly<{
  op: "get";
  id: string;
}>;

export type Command = CreateCommand | SubmitCommand | ApproveCommand | RejectCommand | PayCommand | GetCommand;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const nonemptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const nonblankString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const amountCents = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : undefined;

const parsedId = (value: unknown): string | undefined => {
  const id = ExpenseId.parse(value);
  return id === undefined ? undefined : id;
};

const parsedEmployeeId = (value: unknown): string | undefined => {
  const id = EmployeeId.parse(value);
  return id === undefined ? undefined : id;
};

const parsedEmail = (value: unknown): string | undefined => {
  const email = EmailAddress.parse(value);
  return email === undefined ? undefined : email;
};

const parseCreate = (raw: Record<string, unknown>): CreateCommand | undefined => {
  const id = parsedId(raw.id);
  const ownerId = parsedEmployeeId(raw.ownerId);
  const ownerEmail = parsedEmail(raw.ownerEmail);
  const description = nonblankString(raw.description);
  const amount = amountCents(raw.amountCents);
  return id === undefined ||
    ownerId === undefined ||
    ownerEmail === undefined ||
    description === undefined ||
    amount === undefined
    ? undefined
    : {
        op: "create",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents: amount,
      };
};

const parseSubmit = (raw: Record<string, unknown>): SubmitCommand | undefined => {
  const id = parsedId(raw.id);
  const actorId = parsedEmployeeId(raw.actorId);
  return id === undefined || actorId === undefined
    ? undefined
    : {
        op: "submit",
        id,
        actorId,
      };
};

const parseApprove = (raw: Record<string, unknown>): ApproveCommand | undefined => {
  const id = parsedId(raw.id);
  const actorId = parsedEmployeeId(raw.actorId);
  return id === undefined || actorId === undefined
    ? undefined
    : {
        op: "approve",
        id,
        actorId,
      };
};

const parseReject = (raw: Record<string, unknown>): RejectCommand | undefined => {
  const id = parsedId(raw.id);
  const actorId = parsedEmployeeId(raw.actorId);
  const reason = nonblankString(raw.reason);
  return id === undefined || actorId === undefined || reason === undefined
    ? undefined
    : {
        op: "reject",
        id,
        actorId,
        reason,
      };
};

const parsePay = (raw: Record<string, unknown>): PayCommand | undefined => {
  const id = parsedId(raw.id);
  return id === undefined
    ? undefined
    : {
        op: "pay",
        id,
      };
};

const parseGet = (raw: Record<string, unknown>): GetCommand | undefined => {
  const id = parsedId(raw.id);
  return id === undefined
    ? undefined
    : {
        op: "get",
        id,
      };
};

export const Command = {
  parse: (raw: unknown): Command | undefined => {
    if (!isRecord(raw)) {
      return undefined;
    }

    if (nonemptyString(raw.op) === undefined) {
      return undefined;
    }

    switch (raw.op) {
      case "create":
        return parseCreate(raw);
      case "submit":
        return parseSubmit(raw);
      case "approve":
        return parseApprove(raw);
      case "reject":
        return parseReject(raw);
      case "pay":
        return parsePay(raw);
      case "get":
        return parseGet(raw);
      default:
        return undefined;
    }
  },
} as const;
