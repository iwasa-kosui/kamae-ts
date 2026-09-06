import { AmountCents, type AmountCents as AmountCentsType } from "./amount-cents";
import { EmployeeId, type EmployeeId as EmployeeIdType } from "./employee-id";
import { EmailAddress, type EmailAddress as EmailAddressType } from "./email-address";
import { ExpenseDescription, type ExpenseDescription as ExpenseDescriptionType } from "./expense-description";
import { ExpenseId, type ExpenseId as ExpenseIdType } from "./expense-id";
import { err, ok, type Result } from "./result";
import { isRecord, readStringField } from "./validation";

type Draft = Readonly<{ kind: "draft" }>;

type Submitted = Readonly<{ kind: "submitted" }>;

type Approved = Readonly<{ kind: "approved"; reviewerId: EmployeeIdType }>;

type Rejected = Readonly<{
  kind: "rejected";
  reviewerId: EmployeeIdType;
  reason: string;
}>;

type Paid = Readonly<{ kind: "paid"; receiptId: string }>;

export type ExpenseState = Draft | Submitted | Approved | Rejected | Paid;

export type ExpenseRecord = Readonly<{
  kind: "Expense";
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  ownerEmail: EmailAddressType;
  description: ExpenseDescriptionType;
  amountCents: AmountCentsType;
  state: ExpenseState;
}>;

export type ExpenseBody = Readonly<{
  id: ExpenseIdType;
  ownerId: EmployeeIdType;
  description: ExpenseDescriptionType;
  amountCents: AmountCentsType;
  state: ExpenseState["kind"];
  reviewerId?: EmployeeIdType;
  reason?: string;
  receiptId?: string;
}>;

export type ExpenseEvent = Readonly<{
  kind: "expense_event";
  action: "created" | "submitted" | "approved" | "rejected" | "paid";
  expenseId: ExpenseIdType;
}>;

export type ExpenseTransitionError =
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid_stage" }>;

const parseError = (message: string) => ({ kind: "ParseError", message } as const);

const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};

const parseExpenseState = (raw: unknown): Result<ExpenseState, Readonly<{ kind: "ParseError"; message: string }>> => {
  if (!isRecord(raw)) {
    return err(parseError("Expense state must be an object"));
  }

  const kindResult = readStringField(raw, "kind");
  if (kindResult.kind === "err") {
    return kindResult;
  }

  switch (kindResult.value) {
    case "draft":
      return ok({ kind: "draft" });
    case "submitted":
      return ok({ kind: "submitted" });
    case "approved": {
      const reviewerId = EmployeeId.parse(raw.reviewerId);
      if (reviewerId.kind === "err") {
        return err(parseError("Approved expenses must include a valid reviewerId"));
      }

      return ok({ kind: "approved", reviewerId: reviewerId.value });
    }
    case "rejected": {
      const reviewerId = EmployeeId.parse(raw.reviewerId);
      if (reviewerId.kind === "err") {
        return err(parseError("Rejected expenses must include a valid reviewerId"));
      }

      const reason = typeof raw.reason === "string" && raw.reason.trim().length > 0 ? raw.reason : undefined;
      if (reason === undefined) {
        return err(parseError("Rejected expenses must include a nonblank reason"));
      }

      return ok({ kind: "rejected", reviewerId: reviewerId.value, reason });
    }
    case "paid": {
      const receiptId = typeof raw.receiptId === "string" && raw.receiptId.trim().length > 0 ? raw.receiptId : undefined;
      if (receiptId === undefined) {
        return err(parseError("Paid expenses must include a nonempty receiptId"));
      }

      return ok({ kind: "paid", receiptId });
    }
    default:
      return err(parseError(`Unknown expense state ${kindResult.value}`));
  }
};

const parseExpenseRecord = (
  raw: unknown,
): Result<ExpenseRecord, Readonly<{ kind: "ParseError"; message: string }>> => {
  if (!isRecord(raw)) {
    return err(parseError("Expense record must be an object"));
  }

  const kindResult = readStringField(raw, "kind");
  if (kindResult.kind === "err") {
    return kindResult;
  }

  if (kindResult.value !== "Expense") {
    return err(parseError("Expense record kind must be Expense"));
  }

  const id = ExpenseId.parse(raw.id);
  if (id.kind === "err") {
    return err(parseError("Expense record contains an invalid id"));
  }

  const ownerId = EmployeeId.parse(raw.ownerId);
  if (ownerId.kind === "err") {
    return err(parseError("Expense record contains an invalid ownerId"));
  }

  const ownerEmail = EmailAddress.parse(raw.ownerEmail);
  if (ownerEmail.kind === "err") {
    return err(parseError("Expense record contains an invalid ownerEmail"));
  }

  const description = ExpenseDescription.parse(raw.description);
  if (description.kind === "err") {
    return err(parseError("Expense record contains an invalid description"));
  }

  const amountCents = AmountCents.parse(raw.amountCents);
  if (amountCents.kind === "err") {
    return err(parseError("Expense record contains an invalid amountCents"));
  }

  const state = parseExpenseState(raw.state);
  if (state.kind === "err") {
    return state;
  }

  return ok({
    kind: "Expense",
    id: id.value,
    ownerId: ownerId.value,
    ownerEmail: ownerEmail.value,
    description: description.value,
    amountCents: amountCents.value,
    state: state.value,
  });
};

const transitionToSubmitted = (expense: ExpenseRecord, actorId: EmployeeIdType): Result<ExpenseRecord, ExpenseTransitionError> => {
  if (expense.ownerId !== actorId) {
    return err({ kind: "forbidden" });
  }

  if (expense.state.kind !== "draft") {
    return err({ kind: "invalid_stage" });
  }

  return ok({ ...expense, state: { kind: "submitted" } });
};

const transitionToApproved = (expense: ExpenseRecord, actorId: EmployeeIdType): Result<ExpenseRecord, ExpenseTransitionError> => {
  if (expense.ownerId === actorId) {
    return err({ kind: "forbidden" });
  }

  if (expense.state.kind !== "submitted") {
    return err({ kind: "invalid_stage" });
  }

  return ok({ ...expense, state: { kind: "approved", reviewerId: actorId } });
};

const transitionToRejected = (
  expense: ExpenseRecord,
  actorId: EmployeeIdType,
  reason: string,
): Result<ExpenseRecord, ExpenseTransitionError> => {
  if (expense.ownerId === actorId) {
    return err({ kind: "forbidden" });
  }

  if (expense.state.kind !== "submitted") {
    return err({ kind: "invalid_stage" });
  }

  return ok({ ...expense, state: { kind: "rejected", reviewerId: actorId, reason } });
};

const transitionToPaid = (expense: ExpenseRecord, receiptId: string): Result<ExpenseRecord, ExpenseTransitionError> => {
  if (expense.state.kind !== "approved") {
    return err({ kind: "invalid_stage" });
  }

  return ok({ ...expense, state: { kind: "paid", receiptId } });
};

const toBody = (expense: ExpenseRecord): ExpenseBody => {
  switch (expense.state.kind) {
    case "draft":
      return {
        id: expense.id,
        ownerId: expense.ownerId,
        description: expense.description,
        amountCents: expense.amountCents,
        state: expense.state.kind,
      };
    case "submitted":
      return {
        id: expense.id,
        ownerId: expense.ownerId,
        description: expense.description,
        amountCents: expense.amountCents,
        state: expense.state.kind,
      };
    case "approved":
      return {
        id: expense.id,
        ownerId: expense.ownerId,
        description: expense.description,
        amountCents: expense.amountCents,
        state: expense.state.kind,
        reviewerId: expense.state.reviewerId,
      };
    case "rejected":
      return {
        id: expense.id,
        ownerId: expense.ownerId,
        description: expense.description,
        amountCents: expense.amountCents,
        state: expense.state.kind,
        reviewerId: expense.state.reviewerId,
        reason: expense.state.reason,
      };
    case "paid":
      return {
        id: expense.id,
        ownerId: expense.ownerId,
        description: expense.description,
        amountCents: expense.amountCents,
        state: expense.state.kind,
        receiptId: expense.state.receiptId,
      };
    default:
      return assertNever(expense.state);
  }
};

const toLogEvent = (action: ExpenseEvent["action"], expenseId: ExpenseIdType): ExpenseEvent => ({
  kind: "expense_event",
  action,
  expenseId,
});

export const Expense = {
  parseRecord: parseExpenseRecord,
  submit: transitionToSubmitted,
  approve: transitionToApproved,
  reject: transitionToRejected,
  pay: transitionToPaid,
  toBody,
  toLogEvent,
} as const;
