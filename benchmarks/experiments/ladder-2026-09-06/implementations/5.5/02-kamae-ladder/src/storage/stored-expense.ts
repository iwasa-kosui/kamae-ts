import * as z from "zod";
import { AmountCents } from "../domain/amount-cents";
import { Description } from "../domain/description";
import { EmployeeId } from "../domain/employee-id";
import { Expense, type Expense as ExpenseState } from "../domain/expense";
import { ExpenseId } from "../domain/expense-id";
import { OwnerEmail } from "../domain/owner-email";
import { ReceiptId } from "../domain/receipt-id";
import { RejectionReason } from "../domain/rejection-reason";
import { Sensitive } from "../domain/sensitive";

const StoredBase = z.object({
  schemaVersion: z.literal(1),
  id: ExpenseId.schema,
  ownerId: EmployeeId.schema,
  ownerEmail: OwnerEmail.rawSchema,
  description: Description.schema,
  amountCents: AmountCents.schema,
});

const StoredExpenseSchema = z.discriminatedUnion("kind", [
  StoredBase.extend({ kind: z.literal("draft") }),
  StoredBase.extend({ kind: z.literal("submitted") }),
  StoredBase.extend({ kind: z.literal("approved"), reviewerId: EmployeeId.schema }),
  StoredBase.extend({ kind: z.literal("rejected"), reviewerId: EmployeeId.schema, reason: RejectionReason.schema }),
  StoredBase.extend({ kind: z.literal("paid"), reviewerId: EmployeeId.schema, receiptId: ReceiptId.schema }),
]);

export type StoredExpense = z.infer<typeof StoredExpenseSchema>;

export const StoredExpense = {
  parse: (raw: unknown) => {
    const result = StoredExpenseSchema.safeParse(raw);
    if (!result.success) return undefined;

    const ownerEmail = Sensitive.of(result.data.ownerEmail);
    switch (result.data.kind) {
      case "draft":
        return Expense.createDraft(
          result.data.id,
          result.data.ownerId,
          ownerEmail,
          result.data.description,
          result.data.amountCents,
        );
      case "submitted":
        return {
          kind: "submitted",
          id: result.data.id,
          ownerId: result.data.ownerId,
          ownerEmail,
          description: result.data.description,
          amountCents: result.data.amountCents,
        } satisfies ExpenseState;
      case "approved":
        return {
          kind: "approved",
          id: result.data.id,
          ownerId: result.data.ownerId,
          ownerEmail,
          description: result.data.description,
          amountCents: result.data.amountCents,
          reviewerId: result.data.reviewerId,
        } satisfies ExpenseState;
      case "rejected":
        return {
          kind: "rejected",
          id: result.data.id,
          ownerId: result.data.ownerId,
          ownerEmail,
          description: result.data.description,
          amountCents: result.data.amountCents,
          reviewerId: result.data.reviewerId,
          reason: result.data.reason,
        } satisfies ExpenseState;
      case "paid":
        return {
          kind: "paid",
          id: result.data.id,
          ownerId: result.data.ownerId,
          ownerEmail,
          description: result.data.description,
          amountCents: result.data.amountCents,
          reviewerId: result.data.reviewerId,
          receiptId: result.data.receiptId,
        } satisfies ExpenseState;
    }
  },

  fromExpense: (expense: ExpenseState): StoredExpense => {
    const base = {
      schemaVersion: 1,
      id: expense.id,
      ownerId: expense.ownerId,
      ownerEmail: expense.ownerEmail.unwrap(),
      description: expense.description,
      amountCents: expense.amountCents,
    } as const;

    switch (expense.kind) {
      case "draft":
        return { ...base, kind: "draft" };
      case "submitted":
        return { ...base, kind: "submitted" };
      case "approved":
        return { ...base, kind: "approved", reviewerId: expense.reviewerId };
      case "rejected":
        return { ...base, kind: "rejected", reviewerId: expense.reviewerId, reason: expense.reason };
      case "paid":
        return { ...base, kind: "paid", reviewerId: expense.reviewerId, receiptId: expense.receiptId };
    }
  },
} as const;
