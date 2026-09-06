import * as z from "zod";
import { AmountCents } from "../domain/amount-cents";
import { EmployeeId } from "../domain/employee-id";
import { ExpenseDescription } from "../domain/expense-description";
import { ExpenseId } from "../domain/expense-id";
import { OwnerEmail } from "../domain/owner-email";
import { ReceiptId } from "../domain/receipt-id";
import { RejectionReason } from "../domain/rejection-reason";
import { schemaResult } from "../support/schema-result";

export const StoredExpense = z.discriminatedUnion("kind", [
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("DraftExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: OwnerEmail.valueSchema,
    description: ExpenseDescription.schema,
    amountCents: AmountCents.schema,
  }),
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("SubmittedExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: OwnerEmail.valueSchema,
    description: ExpenseDescription.schema,
    amountCents: AmountCents.schema,
  }),
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("ApprovedExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: OwnerEmail.valueSchema,
    description: ExpenseDescription.schema,
    amountCents: AmountCents.schema,
    reviewerId: EmployeeId.schema,
  }),
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("RejectedExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: OwnerEmail.valueSchema,
    description: ExpenseDescription.schema,
    amountCents: AmountCents.schema,
    reviewerId: EmployeeId.schema,
    reason: RejectionReason.schema,
  }),
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("PaidExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: OwnerEmail.valueSchema,
    description: ExpenseDescription.schema,
    amountCents: AmountCents.schema,
    reviewerId: EmployeeId.schema,
    receiptId: ReceiptId.schema,
  }),
]);

export type StoredExpense = z.infer<typeof StoredExpense>;

export const StoredExpenseParser = {
  parse: schemaResult(StoredExpense),
} as const;
