import { AmountCents } from "./amount-cents";
import { EmployeeId } from "./employee-id";
import { EmailAddress } from "./email-address";
import { ExpenseDescription } from "./expense-description";
import { ExpenseId } from "./expense-id";
import { err, ok, type Result } from "./result";
import { isRecord, readStringField } from "./validation";

export type CreateCommand = Readonly<{
  op: "create";
  id: ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never;
  ownerId: ReturnType<typeof EmployeeId.parse> extends Result<infer T, unknown> ? T : never;
  ownerEmail: ReturnType<typeof EmailAddress.parse> extends Result<infer T, unknown> ? T : never;
  description: ReturnType<typeof ExpenseDescription.parse> extends Result<infer T, unknown> ? T : never;
  amountCents: ReturnType<typeof AmountCents.parse> extends Result<infer T, unknown> ? T : never;
}>;

export type SubmitCommand = Readonly<{
  op: "submit";
  id: ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never;
  actorId: ReturnType<typeof EmployeeId.parse> extends Result<infer T, unknown> ? T : never;
}>;

export type ApproveCommand = Readonly<{
  op: "approve";
  id: ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never;
  actorId: ReturnType<typeof EmployeeId.parse> extends Result<infer T, unknown> ? T : never;
}>;

export type RejectCommand = Readonly<{
  op: "reject";
  id: ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never;
  actorId: ReturnType<typeof EmployeeId.parse> extends Result<infer T, unknown> ? T : never;
  reason: string;
}>;

export type PayCommand = Readonly<{
  op: "pay";
  id: ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never;
}>;

export type GetCommand = Readonly<{
  op: "get";
  id: ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never;
}>;

export type Command = CreateCommand | SubmitCommand | ApproveCommand | RejectCommand | PayCommand | GetCommand;

export type CommandParseError = Readonly<{
  kind: "CommandParseError";
  code: "invalid_command";
  message: string;
}>;

const invalidCommand = (message: string): CommandParseError => ({
  kind: "CommandParseError",
  code: "invalid_command",
  message,
});

const parseExpenseId = (raw: unknown): Result<ReturnType<typeof ExpenseId.parse> extends Result<infer T, unknown> ? T : never, CommandParseError> => {
  const result = ExpenseId.parse(raw);
  return result.kind === "ok" ? ok(result.value) : err(invalidCommand(result.error.message));
};

const parseEmployeeId = (raw: unknown): Result<ReturnType<typeof EmployeeId.parse> extends Result<infer T, unknown> ? T : never, CommandParseError> => {
  const result = EmployeeId.parse(raw);
  return result.kind === "ok" ? ok(result.value) : err(invalidCommand(result.error.message));
};

const parseEmailAddress = (raw: unknown): Result<ReturnType<typeof EmailAddress.parse> extends Result<infer T, unknown> ? T : never, CommandParseError> => {
  const result = EmailAddress.parse(raw);
  return result.kind === "ok" ? ok(result.value) : err(invalidCommand(result.error.message));
};

const parseDescription = (raw: unknown): Result<ReturnType<typeof ExpenseDescription.parse> extends Result<infer T, unknown> ? T : never, CommandParseError> => {
  const result = ExpenseDescription.parse(raw);
  return result.kind === "ok" ? ok(result.value) : err(invalidCommand(result.error.message));
};

const parseAmount = (raw: unknown): Result<ReturnType<typeof AmountCents.parse> extends Result<infer T, unknown> ? T : never, CommandParseError> => {
  const result = AmountCents.parse(raw);
  return result.kind === "ok" ? ok(result.value) : err(invalidCommand(result.error.message));
};

const parseCreate = (record: Record<string, unknown>): Result<CreateCommand, CommandParseError> => {
  const id = parseExpenseId(record.id);
  if (id.kind === "err") return id;

  const ownerId = parseEmployeeId(record.ownerId);
  if (ownerId.kind === "err") return ownerId;

  const ownerEmail = parseEmailAddress(record.ownerEmail);
  if (ownerEmail.kind === "err") return ownerEmail;

  const description = parseDescription(record.description);
  if (description.kind === "err") return description;

  const amountCents = parseAmount(record.amountCents);
  if (amountCents.kind === "err") return amountCents;

  return ok({
    op: "create",
    id: id.value,
    ownerId: ownerId.value,
    ownerEmail: ownerEmail.value,
    description: description.value,
    amountCents: amountCents.value,
  });
};

const parseSubmit = (record: Record<string, unknown>): Result<SubmitCommand, CommandParseError> => {
  const id = parseExpenseId(record.id);
  if (id.kind === "err") return id;

  const actorId = parseEmployeeId(record.actorId);
  if (actorId.kind === "err") return actorId;

  return ok({
    op: "submit",
    id: id.value,
    actorId: actorId.value,
  });
};

const parseApprove = (record: Record<string, unknown>): Result<ApproveCommand, CommandParseError> => {
  const id = parseExpenseId(record.id);
  if (id.kind === "err") return id;

  const actorId = parseEmployeeId(record.actorId);
  if (actorId.kind === "err") return actorId;

  return ok({
    op: "approve",
    id: id.value,
    actorId: actorId.value,
  });
};

const parseReject = (record: Record<string, unknown>): Result<RejectCommand, CommandParseError> => {
  const id = parseExpenseId(record.id);
  if (id.kind === "err") return id;

  const actorId = parseEmployeeId(record.actorId);
  if (actorId.kind === "err") return actorId;

  const reason = readStringField(record, "reason");
  if (reason.kind === "err") {
    return err(invalidCommand(reason.error.message));
  }

  if (reason.value.trim().length === 0) {
    return err(invalidCommand("Reject reason must be nonblank"));
  }

  return ok({
    op: "reject",
    id: id.value,
    actorId: actorId.value,
    reason: reason.value,
  });
};

const parsePay = (record: Record<string, unknown>): Result<PayCommand, CommandParseError> => {
  const id = parseExpenseId(record.id);
  if (id.kind === "err") return id;

  return ok({ op: "pay", id: id.value });
};

const parseGet = (record: Record<string, unknown>): Result<GetCommand, CommandParseError> => {
  const id = parseExpenseId(record.id);
  if (id.kind === "err") return id;

  return ok({ op: "get", id: id.value });
};

export const parseCommand = (raw: unknown): Result<Command, CommandParseError> => {
  if (!isRecord(raw)) {
    return err(invalidCommand("Command must be an object"));
  }

  const op = readStringField(raw, "op");
  if (op.kind === "err") {
    return err(invalidCommand(op.error.message));
  }

  switch (op.value) {
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
      return err(invalidCommand(`Unknown op ${op.value}`));
  }
};
