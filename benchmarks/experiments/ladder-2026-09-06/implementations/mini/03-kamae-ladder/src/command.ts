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

export type CommandParseResult =
  | Readonly<{ ok: true; value: Command }>
  | Readonly<{ ok: false }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readPositiveAmount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1_000_000
    ? value
    : undefined;
}

function hasNonWhitespaceText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: string): boolean {
  if (value.length === 0 || /\s/.test(value)) {
    return false;
  }

  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@") || atIndex === value.length - 1) {
    return false;
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (local.length === 0 || domain.length === 0 || domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }

  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => label.length > 0 && !label.startsWith("-") && !label.endsWith("-"));
}

function parseCreateCommand(value: Record<string, unknown>): CommandParseResult {
  const id = readString(value.id);
  const ownerId = readString(value.ownerId);
  const ownerEmail = readString(value.ownerEmail);
  const description = readString(value.description);
  const amountCents = readPositiveAmount(value.amountCents);

  if (
    id === undefined ||
    ownerId === undefined ||
    ownerEmail === undefined ||
    description === undefined ||
    amountCents === undefined ||
    !isValidEmail(ownerEmail) ||
    id.length === 0 ||
    ownerId.length === 0 ||
    description.trim().length === 0
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      op: "create",
      id,
      ownerId,
      ownerEmail,
      description,
      amountCents,
    },
  };
}

function parseIdActorCommand(value: Record<string, unknown>, op: "submit" | "approve"): CommandParseResult {
  const id = readString(value.id);
  const actorId = readString(value.actorId);

  if (id === undefined || actorId === undefined || id.length === 0 || actorId.length === 0) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      op,
      id,
      actorId,
    },
  };
}

function parseRejectCommand(value: Record<string, unknown>): CommandParseResult {
  const id = readString(value.id);
  const actorId = readString(value.actorId);
  const reason = readString(value.reason);

  if (
    id === undefined ||
    actorId === undefined ||
    reason === undefined ||
    id.length === 0 ||
    actorId.length === 0 ||
    reason.trim().length === 0
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      op: "reject",
      id,
      actorId,
      reason,
    },
  };
}

function parseSingleIdCommand(value: Record<string, unknown>, op: "pay" | "get"): CommandParseResult {
  const id = readString(value.id);

  if (id === undefined || id.length === 0) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      op,
      id,
    },
  };
}

export function parseCommand(command: unknown): CommandParseResult {
  if (!isRecord(command)) {
    return { ok: false };
  }

  const op = readString(command.op);
  if (op === undefined) {
    return { ok: false };
  }

  switch (op) {
    case "create":
      return parseCreateCommand(command);
    case "submit":
      return parseIdActorCommand(command, "submit");
    case "approve":
      return parseIdActorCommand(command, "approve");
    case "reject":
      return parseRejectCommand(command);
    case "pay":
      return parseSingleIdCommand(command, "pay");
    case "get":
      return parseSingleIdCommand(command, "get");
    default:
      return { ok: false };
  }
}
