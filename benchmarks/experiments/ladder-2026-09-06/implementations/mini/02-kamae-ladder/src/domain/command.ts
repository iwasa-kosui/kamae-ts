import { EmailAddress } from "./email-address";
import { EmployeeId } from "./employee-id";
import { ExpenseId } from "./expense-id";

type RawRecord = Readonly<Record<string, unknown>>;

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

export type PayCommand = Readonly<{
  op: "pay";
  id: string;
}>;

export type GetCommand = Readonly<{
  op: "get";
  id: string;
}>;

export type Command = CreateCommand | SubmitCommand | ApproveCommand | RejectCommand | PayCommand | GetCommand;

export type ParsedCreateCommand = Readonly<{
  kind: "create";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

export type ParsedActorCommand = Readonly<{
  kind: "submit" | "approve" | "reject";
  id: ExpenseId;
}>;

export type ParsedSubmitCommand = Readonly<{
  kind: "submit";
  id: ExpenseId;
  actorId: EmployeeId;
}>;

export type ParsedApproveCommand = Readonly<{
  kind: "approve";
  id: ExpenseId;
  actorId: EmployeeId;
}>;

export type ParsedRejectCommand = Readonly<{
  kind: "reject";
  id: ExpenseId;
  actorId: EmployeeId;
  reason: string;
}>;

export type ParsedSimpleCommand = Readonly<{
  kind: "pay" | "get";
  id: ExpenseId;
}>;

export type ParsedPayCommand = Readonly<{
  kind: "pay";
  id: ExpenseId;
}>;

export type ParsedGetCommand = Readonly<{
  kind: "get";
  id: ExpenseId;
}>;

export type ParsedCommand =
  | ParsedCreateCommand
  | ParsedSubmitCommand
  | ParsedApproveCommand
  | ParsedRejectCommand
  | ParsedPayCommand
  | ParsedGetCommand;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseOperation = (raw: unknown): Command["op"] | undefined =>
  raw === "create" || raw === "submit" || raw === "approve" || raw === "reject" || raw === "pay" || raw === "get"
    ? raw
    : undefined;

const parseDescription = (raw: unknown): string | undefined =>
  typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;

const parseAmountCents = (raw: unknown): number | undefined =>
  typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 1_000_000 ? raw : undefined;

const parseReason = (raw: unknown): string | undefined =>
  typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;

export const Command = {
  parse: (raw: unknown): ParsedCommand | undefined => {
    if (!isRecord(raw)) return undefined;

    const op = parseOperation(raw.op);
    if (op === undefined) return undefined;

    const id = ExpenseId.parse(raw.id);
    if (id === undefined) return undefined;

    if (op === "create") {
      const ownerId = EmployeeId.parse(raw.ownerId);
      const ownerEmail = EmailAddress.parse(raw.ownerEmail);
      const description = parseDescription(raw.description);
      const amountCents = parseAmountCents(raw.amountCents);
      if (
        ownerId === undefined ||
        ownerEmail === undefined ||
        description === undefined ||
        amountCents === undefined
      ) {
        return undefined;
      }

      return {
        kind: "create",
        id,
        ownerId,
        ownerEmail,
        description,
        amountCents,
      };
    }

    if (op === "reject") {
      const actorId = EmployeeId.parse(raw.actorId);
      const reason = parseReason(raw.reason);
      if (actorId === undefined || reason === undefined) return undefined;
      return { kind: "reject", id, actorId, reason };
    }

    if (op === "submit" || op === "approve") {
      const actorId = EmployeeId.parse(raw.actorId);
      if (actorId === undefined) return undefined;
      return { kind: op, id, actorId };
    }

    return { kind: op, id };
  },
} as const;
