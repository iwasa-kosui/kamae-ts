import { EmployeeId } from "./employee-id";
import { ExpenseId } from "./expense-id";
import { Expense, type Expense as ExpenseType } from "./expense";
import { Result, type Result as ResultType } from "./result";
import { invalidCommand, isRecord, parseEmailAddress, parseNonemptyString, parsePositiveInteger } from "./validation";

type StoredExpenseRecordV1 = Readonly<{
  schemaVersion: 1;
  kind: ExpenseType["kind"];
  id: string;
  ownerId: string;
  ownerEmail: string;
  description: string;
  amountCents: number;
  reviewerId?: string;
  reason?: string;
  receiptId?: string;
}>;

export type RecordValidationError = Readonly<{
  code: "invalid_record";
}>;

const invalidRecord = { code: "invalid_record" } as const satisfies RecordValidationError;

const parseExpenseRecord = (value: unknown): ResultType<ExpenseType, RecordValidationError> => {
  if (!isRecord(value)) {
    return Result.err(invalidRecord);
  }

  if (value.schemaVersion !== 1) {
    return Result.err(invalidRecord);
  }

  if (
    value.kind !== "draft" &&
    value.kind !== "submitted" &&
    value.kind !== "approved" &&
    value.kind !== "rejected" &&
    value.kind !== "paid"
  ) {
    return Result.err(invalidRecord);
  }

  const idResult = ExpenseId.parse(value.id);
  const ownerIdResult = EmployeeId.parse(value.ownerId);
  const ownerEmailResult = parseEmailAddress(value.ownerEmail);
  const descriptionResult = parseNonemptyString(value.description);
  const amountResult = parsePositiveInteger(value.amountCents, 1, 1_000_000);

  if (
    Result.isErr(idResult) ||
    Result.isErr(ownerIdResult) ||
    Result.isErr(ownerEmailResult) ||
    Result.isErr(descriptionResult) ||
    Result.isErr(amountResult)
  ) {
    return Result.err(invalidRecord);
  }

  if (value.kind === "draft") {
    return Result.ok(
      Expense.create(idResult.value, ownerIdResult.value, ownerEmailResult.value, descriptionResult.value, amountResult.value),
    );
  }

  if (value.kind === "submitted") {
    return Result.ok({
      kind: "submitted",
      id: idResult.value,
      ownerId: ownerIdResult.value,
      ownerEmail: ownerEmailResult.value,
      description: descriptionResult.value,
      amountCents: amountResult.value,
    });
  }

  if (value.kind === "approved") {
    const reviewerIdResult = EmployeeId.parse(value.reviewerId);
    if (Result.isErr(reviewerIdResult)) {
      return Result.err(invalidRecord);
    }

    return Result.ok({
      kind: "approved",
      id: idResult.value,
      ownerId: ownerIdResult.value,
      ownerEmail: ownerEmailResult.value,
      description: descriptionResult.value,
      amountCents: amountResult.value,
      reviewerId: reviewerIdResult.value,
    });
  }

  if (value.kind === "rejected") {
    const reviewerIdResult = EmployeeId.parse(value.reviewerId);
    const reasonResult = parseNonemptyString(value.reason);
    if (Result.isErr(reviewerIdResult) || Result.isErr(reasonResult)) {
      return Result.err(invalidRecord);
    }

    return Result.ok({
      kind: "rejected",
      id: idResult.value,
      ownerId: ownerIdResult.value,
      ownerEmail: ownerEmailResult.value,
      description: descriptionResult.value,
      amountCents: amountResult.value,
      reviewerId: reviewerIdResult.value,
      reason: reasonResult.value,
    });
  }

  const receiptIdResult = parseNonemptyString(value.receiptId);
  if (Result.isErr(receiptIdResult)) {
    return Result.err(invalidRecord);
  }

  const reviewerIdResult = value.reviewerId === undefined ? Result.ok(undefined) : EmployeeId.parse(value.reviewerId);
  if (Result.isErr(reviewerIdResult)) {
    return Result.err(invalidRecord);
  }

  return Result.ok({
    kind: "paid",
    id: idResult.value,
    ownerId: ownerIdResult.value,
    ownerEmail: ownerEmailResult.value,
    description: descriptionResult.value,
    amountCents: amountResult.value,
    reviewerId: reviewerIdResult.value,
    receiptId: receiptIdResult.value,
  });
};

const toStoredRecord = (expense: ExpenseType): StoredExpenseRecordV1 => ({
  schemaVersion: 1,
  kind: expense.kind,
  id: expense.id,
  ownerId: expense.ownerId,
  ownerEmail: expense.ownerEmail,
  description: expense.description,
  amountCents: expense.amountCents,
  ...("reviewerId" in expense ? { reviewerId: expense.reviewerId } : {}),
  ...("reason" in expense ? { reason: expense.reason } : {}),
  ...("receiptId" in expense ? { receiptId: expense.receiptId } : {}),
});

export const Record = {
  parse: parseExpenseRecord,
  serialize: toStoredRecord,
  invalidRecord,
} as const;
