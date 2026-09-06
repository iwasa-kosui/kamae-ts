export const ExpenseIdBrand = Symbol("ExpenseId");
export type ExpenseId = string & { readonly [ExpenseIdBrand]: never };

export const EmployeeIdBrand = Symbol("EmployeeId");
export type EmployeeId = string & { readonly [EmployeeIdBrand]: never };

export const EmailAddressBrand = Symbol("EmailAddress");
export type EmailAddress = string & { readonly [EmailAddressBrand]: never };

export type ValidationError = Readonly<{
  kind: "invalid";
  code: "invalid_command";
}>;

type ParseSuccess<T> = Readonly<{
  ok: true;
  value: T;
}>;

type ParseFailure = Readonly<{
  ok: false;
}>;

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type CreateCommand = Readonly<{
  op: "create";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: string;
  amountCents: number;
}>;

export type SubmitCommand = Readonly<{
  op: "submit";
  id: ExpenseId;
  actorId: EmployeeId;
}>;

export type ApproveCommand = Readonly<{
  op: "approve";
  id: ExpenseId;
  actorId: EmployeeId;
}>;

export type RejectCommand = Readonly<{
  op: "reject";
  id: ExpenseId;
  actorId: EmployeeId;
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

export type Command =
  | CreateCommand
  | SubmitCommand
  | ApproveCommand
  | RejectCommand
  | PayCommand
  | GetCommand;

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isEmailAddress = (value: unknown): value is EmailAddress =>
  typeof value === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isExpenseId = (value: unknown): value is ExpenseId => hasText(value);

const isEmployeeId = (value: unknown): value is EmployeeId => hasText(value);

const isAmountCents = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 1_000_000;

const invalid = (): ParseFailure => ({ ok: false });

const success = <T>(value: T): ParseSuccess<T> => ({ ok: true, value });

const parseCreateCommand = (raw: Record<string, unknown>): ParseResult<CreateCommand> => {
  if (raw.op !== "create") return invalid();
  if (!isExpenseId(raw.id)) return invalid();
  if (!isEmployeeId(raw.ownerId)) return invalid();
  if (!isEmailAddress(raw.ownerEmail)) return invalid();
  if (!hasText(raw.description)) return invalid();
  if (!isAmountCents(raw.amountCents)) return invalid();

  return success({
    op: "create",
    id: raw.id,
    ownerId: raw.ownerId,
    ownerEmail: raw.ownerEmail,
    description: raw.description.trim(),
    amountCents: raw.amountCents,
  });
};

const parseSubmitCommand = (raw: Record<string, unknown>): ParseResult<SubmitCommand> => {
  if (raw.op !== "submit") return invalid();
  if (!isExpenseId(raw.id)) return invalid();
  if (!isEmployeeId(raw.actorId)) return invalid();
  return success({ op: "submit", id: raw.id, actorId: raw.actorId });
};

const parseApproveCommand = (raw: Record<string, unknown>): ParseResult<ApproveCommand> => {
  if (raw.op !== "approve") return invalid();
  if (!isExpenseId(raw.id)) return invalid();
  if (!isEmployeeId(raw.actorId)) return invalid();
  return success({ op: "approve", id: raw.id, actorId: raw.actorId });
};

const parseRejectCommand = (raw: Record<string, unknown>): ParseResult<RejectCommand> => {
  if (raw.op !== "reject") return invalid();
  if (!isExpenseId(raw.id)) return invalid();
  if (!isEmployeeId(raw.actorId)) return invalid();
  if (!hasText(raw.reason)) return invalid();
  return success({
    op: "reject",
    id: raw.id,
    actorId: raw.actorId,
    reason: raw.reason.trim(),
  });
};

const parsePayCommand = (raw: Record<string, unknown>): ParseResult<PayCommand> => {
  if (raw.op !== "pay") return invalid();
  if (!isExpenseId(raw.id)) return invalid();
  return success({ op: "pay", id: raw.id });
};

const parseGetCommand = (raw: Record<string, unknown>): ParseResult<GetCommand> => {
  if (raw.op !== "get") return invalid();
  if (!isExpenseId(raw.id)) return invalid();
  return success({ op: "get", id: raw.id });
};

export const parseCommand = (raw: unknown): ParseResult<Command> => {
  if (!isPlainObject(raw)) return invalid();

  switch (raw.op) {
    case "create":
      return parseCreateCommand(raw);
    case "submit":
      return parseSubmitCommand(raw);
    case "approve":
      return parseApproveCommand(raw);
    case "reject":
      return parseRejectCommand(raw);
    case "pay":
      return parsePayCommand(raw);
    case "get":
      return parseGetCommand(raw);
    default:
      return invalid();
  }
};

export const toExpenseId = (value: string): ExpenseId => value as ExpenseId;
export const toEmployeeId = (value: string): EmployeeId => value as EmployeeId;
export const toEmailAddress = (value: string): EmailAddress => value as EmailAddress;
