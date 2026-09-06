import * as z from "zod";
import { Expense, type Expense as ExpenseState } from "../domain/expense";
import {
  AmountCents,
  Description,
  EmployeeId,
  ExpenseId,
  OwnerEmail,
  RejectionReason,
} from "../domain/value-objects";
import { assertNever, schemaResult } from "../result";

const StoredDraftExpenseSchema = z.object({
  kind: z.literal("Draft"),
  id: ExpenseId.schema,
  ownerId: EmployeeId.schema,
  ownerEmail: OwnerEmail.schema,
  description: Description.schema,
  amountCents: AmountCents.schema,
});

const StoredSubmittedExpenseSchema = StoredDraftExpenseSchema.extend({
  kind: z.literal("Submitted"),
});

const StoredApprovedExpenseSchema = StoredDraftExpenseSchema.extend({
  kind: z.literal("Approved"),
  reviewerId: EmployeeId.schema,
});

const StoredRejectedExpenseSchema = StoredDraftExpenseSchema.extend({
  kind: z.literal("Rejected"),
  reviewerId: EmployeeId.schema,
  reason: RejectionReason.schema,
});

const StoredPaidExpenseSchema = StoredDraftExpenseSchema.extend({
  kind: z.literal("Paid"),
  reviewerId: EmployeeId.schema,
  receiptId: z.string().min(1),
});

const StoredExpenseSchema = z.discriminatedUnion("kind", [
  StoredDraftExpenseSchema,
  StoredSubmittedExpenseSchema,
  StoredApprovedExpenseSchema,
  StoredRejectedExpenseSchema,
  StoredPaidExpenseSchema,
]);

export type StoredExpenseInput = z.input<typeof StoredExpenseSchema>;
export type StoredExpense = z.infer<typeof StoredExpenseSchema>;

export const StoredExpense = {
  schema: StoredExpenseSchema,
  parse: schemaResult(StoredExpenseSchema),

  encode: (expense: ExpenseState): StoredExpenseInput => {
    const base = {
      id: expense.id,
      ownerId: expense.ownerId,
      ownerEmail: expense.ownerEmail.unwrap(),
      description: expense.description,
      amountCents: expense.amountCents,
    };

    switch (expense.kind) {
      case "Draft":
        return { kind: "Draft", ...base };
      case "Submitted":
        return { kind: "Submitted", ...base };
      case "Approved":
        return { kind: "Approved", ...base, reviewerId: expense.reviewerId };
      case "Rejected":
        return {
          kind: "Rejected",
          ...base,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "Paid":
        return {
          kind: "Paid",
          ...base,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
      default:
        return assertNever(expense);
    }
  },

  decode: (stored: StoredExpense): ExpenseState => {
    switch (stored.kind) {
      case "Draft":
        return Expense.create(
          stored.id,
          stored.ownerId,
          stored.ownerEmail,
          stored.description,
          stored.amountCents,
        );
      case "Submitted":
        return Expense.submit(
          Expense.create(
            stored.id,
            stored.ownerId,
            stored.ownerEmail,
            stored.description,
            stored.amountCents,
          ),
        );
      case "Approved":
        return Expense.approve(
          Expense.submit(
            Expense.create(
              stored.id,
              stored.ownerId,
              stored.ownerEmail,
              stored.description,
              stored.amountCents,
            ),
          ),
          stored.reviewerId,
        );
      case "Rejected":
        return Expense.reject(
          Expense.submit(
            Expense.create(
              stored.id,
              stored.ownerId,
              stored.ownerEmail,
              stored.description,
              stored.amountCents,
            ),
          ),
          stored.reviewerId,
          stored.reason,
        );
      case "Paid":
        return Expense.markPaid(
          Expense.approve(
            Expense.submit(
              Expense.create(
                stored.id,
                stored.ownerId,
                stored.ownerEmail,
                stored.description,
                stored.amountCents,
              ),
            ),
            stored.reviewerId,
          ),
          stored.receiptId,
        );
      default:
        return assertNever(stored);
    }
  },
} as const;
