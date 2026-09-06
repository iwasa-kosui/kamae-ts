import { EmployeeId } from "./employee-id";
import type { EmployeeId as EmployeeIdType } from "./employee-id";
import { ExpenseId } from "./expense-id";
import { Result, type Result as ResultType } from "./result";
import {
  invalidCommand,
  isRecord,
  parseEmailAddress,
  parseNonemptyString,
  parsePositiveInteger,
} from "./validation";

export type CreateCommand = Readonly<{
  op: "create";
  id: ExpenseId;
  ownerId: EmployeeIdType;
  ownerEmail: string;
  description: string;
  amountCents: number;
}>;

export type SubmitCommand = Readonly<{
  op: "submit";
  id: ExpenseId;
  actorId: EmployeeIdType;
}>;

export type ApproveCommand = Readonly<{
  op: "approve";
  id: ExpenseId;
  actorId: EmployeeIdType;
}>;

export type RejectCommand = Readonly<{
  op: "reject";
  id: ExpenseId;
  actorId: EmployeeIdType;
  reason: string;
}>;

export type PayCommand = Readonly<{
  op: "pay";
  id: ExpenseId;
}>;

export type GetCommand = Readonly<{
  op: "get";
  id: ExpenseId;
}>;

export type Command = CreateCommand | SubmitCommand | ApproveCommand | RejectCommand | PayCommand | GetCommand;

export type CommandError = Readonly<{
  code: "invalid_command";
}>;

const parseEmployeeIdValue = (value: unknown) => EmployeeId.parse(value);

const invalidCommandError = { code: "invalid_command" } as const satisfies CommandError;

const asCommandError = (): CommandError => invalidCommandError;

const parseCommonExpenseId = (raw: Record<string, unknown>): ResultType<ExpenseId, CommandError> => {
  const result = ExpenseId.parse(raw.id);
  return Result.isOk(result) ? result : Result.err(asCommandError());
};

const parseCreate = (raw: Record<string, unknown>): ResultType<CreateCommand, CommandError> => {
  const idResult = parseCommonExpenseId(raw);
  const ownerIdResult = parseEmployeeIdValue(raw.ownerId);
  const ownerEmailResult = parseEmailAddress(raw.ownerEmail);
  const descriptionResult = parseNonemptyString(raw.description);
  const amountResult = parsePositiveInteger(raw.amountCents, 1, 1_000_000);

  if (
    Result.isErr(idResult) ||
    Result.isErr(ownerIdResult) ||
    Result.isErr(ownerEmailResult) ||
    Result.isErr(descriptionResult) ||
    Result.isErr(amountResult)
  ) {
    return Result.err(asCommandError());
  }

  return Result.ok({
    op: "create",
    id: idResult.value,
    ownerId: ownerIdResult.value,
    ownerEmail: ownerEmailResult.value,
    description: descriptionResult.value,
    amountCents: amountResult.value,
  });
};

const parseSubmit = (raw: Record<string, unknown>): ResultType<SubmitCommand, CommandError> => {
  const idResult = parseCommonExpenseId(raw);
  const actorIdResult = parseEmployeeIdValue(raw.actorId);

  if (Result.isErr(idResult) || Result.isErr(actorIdResult)) {
    return Result.err(asCommandError());
  }

  return Result.ok({
    op: "submit",
    id: idResult.value,
    actorId: actorIdResult.value,
  });
};

const parseApprove = (raw: Record<string, unknown>): ResultType<ApproveCommand, CommandError> => {
  const idResult = parseCommonExpenseId(raw);
  const actorIdResult = parseEmployeeIdValue(raw.actorId);

  if (Result.isErr(idResult) || Result.isErr(actorIdResult)) {
    return Result.err(asCommandError());
  }

  return Result.ok({
    op: "approve",
    id: idResult.value,
    actorId: actorIdResult.value,
  });
};

const parseReject = (raw: Record<string, unknown>): ResultType<RejectCommand, CommandError> => {
  const idResult = parseCommonExpenseId(raw);
  const actorIdResult = parseEmployeeIdValue(raw.actorId);
  const reasonResult = parseNonemptyString(raw.reason);

  if (Result.isErr(idResult) || Result.isErr(actorIdResult) || Result.isErr(reasonResult)) {
    return Result.err(asCommandError());
  }

  return Result.ok({
    op: "reject",
    id: idResult.value,
    actorId: actorIdResult.value,
    reason: reasonResult.value,
  });
};

const parsePay = (raw: Record<string, unknown>): ResultType<PayCommand, CommandError> => {
  const idResult = parseCommonExpenseId(raw);
  if (Result.isErr(idResult)) {
    return Result.err(asCommandError());
  }

  return Result.ok({ op: "pay", id: idResult.value });
};

const parseGet = (raw: Record<string, unknown>): ResultType<GetCommand, CommandError> => {
  const idResult = parseCommonExpenseId(raw);
  if (Result.isErr(idResult)) {
    return Result.err(asCommandError());
  }

  return Result.ok({ op: "get", id: idResult.value });
};

const parseCommand = (raw: unknown): ResultType<Command, CommandError> => {
  if (!isRecord(raw) || typeof raw.op !== "string") {
    return Result.err(asCommandError());
  }

  if (raw.op === "create") return parseCreate(raw);
  if (raw.op === "submit") return parseSubmit(raw);
  if (raw.op === "approve") return parseApprove(raw);
  if (raw.op === "reject") return parseReject(raw);
  if (raw.op === "pay") return parsePay(raw);
  if (raw.op === "get") return parseGet(raw);

  return Result.err(asCommandError());
};

export const Command = {
  parse: parseCommand,
  invalidCommand: asCommandError,
} as const;
