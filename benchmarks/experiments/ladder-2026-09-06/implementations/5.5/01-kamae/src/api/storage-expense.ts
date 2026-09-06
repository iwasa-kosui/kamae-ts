import * as z from "zod";
import { AmountCents } from "../domain/expense/amount-cents";
import { Description } from "../domain/expense/description";
import { EmployeeId } from "../domain/expense/employee-id";
import type { Expense } from "../domain/expense/expense";
import { ExpenseId } from "../domain/expense/expense-id";
import { OwnerEmail } from "../domain/expense/owner-email";
import { ReceiptId } from "../domain/expense/receipt-id";
import { RejectionReason } from "../domain/expense/rejection-reason";
import { assertNever } from "../shared/assert-never";
import { Sensitive } from "../shared/sensitive";
import { schemaResult } from "../shared/validation";

const BaseStorageExpenseSchema = z.object({
  version: z.literal(1),
  id: ExpenseId.schema,
  ownerId: EmployeeId.schema,
  ownerEmail: OwnerEmail.storageSchema.transform(Sensitive.of),
  description: Description.schema,
  amountCents: AmountCents.schema,
});

const StorageExpenseSchema = z.discriminatedUnion("kind", [
  BaseStorageExpenseSchema.extend({
    kind: z.literal("Draft"),
  }),
  BaseStorageExpenseSchema.extend({
    kind: z.literal("Submitted"),
  }),
  BaseStorageExpenseSchema.extend({
    kind: z.literal("Approved"),
    reviewerId: EmployeeId.schema,
  }),
  BaseStorageExpenseSchema.extend({
    kind: z.literal("Rejected"),
    reviewerId: EmployeeId.schema,
    reason: RejectionReason.schema,
  }),
  BaseStorageExpenseSchema.extend({
    kind: z.literal("Paid"),
    reviewerId: EmployeeId.schema,
    receiptId: ReceiptId.schema,
  }),
]);

export type StorageExpense = z.input<typeof StorageExpenseSchema>;

export const StorageExpense = {
  parse: schemaResult(StorageExpenseSchema),

  fromExpense: (expense: Expense): StorageExpense => {
    switch (expense.kind) {
      case "Draft":
        return {
          version: 1,
          kind: "Draft",
          id: expense.id,
          ownerId: expense.ownerId,
          ownerEmail: expense.ownerEmail.unwrap(),
          description: expense.description,
          amountCents: expense.amountCents,
        };
      case "Submitted":
        return {
          version: 1,
          kind: "Submitted",
          id: expense.id,
          ownerId: expense.ownerId,
          ownerEmail: expense.ownerEmail.unwrap(),
          description: expense.description,
          amountCents: expense.amountCents,
        };
      case "Approved":
        return {
          version: 1,
          kind: "Approved",
          id: expense.id,
          ownerId: expense.ownerId,
          ownerEmail: expense.ownerEmail.unwrap(),
          description: expense.description,
          amountCents: expense.amountCents,
          reviewerId: expense.reviewerId,
        };
      case "Rejected":
        return {
          version: 1,
          kind: "Rejected",
          id: expense.id,
          ownerId: expense.ownerId,
          ownerEmail: expense.ownerEmail.unwrap(),
          description: expense.description,
          amountCents: expense.amountCents,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "Paid":
        return {
          version: 1,
          kind: "Paid",
          id: expense.id,
          ownerId: expense.ownerId,
          ownerEmail: expense.ownerEmail.unwrap(),
          description: expense.description,
          amountCents: expense.amountCents,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
      default:
        return assertNever(expense);
    }
  },
} as const;
