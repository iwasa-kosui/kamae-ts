import * as z from "zod";
import { AmountCents } from "./amount-cents";
import { assertNever } from "./assert-never";
import { Description } from "./description";
import { EmailAddress } from "./email-address";
import { EmployeeId } from "./employee-id";
import type { Expense } from "./expense";
import { ExpenseId } from "./expense-id";
import { ReceiptId } from "./receipt-id";
import { RejectionReason } from "./rejection-reason";

const StoredExpenseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("DraftExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: EmailAddress.sensitiveSchema,
    description: Description.schema,
    amountCents: AmountCents.schema,
  }),
  z.object({
    kind: z.literal("SubmittedExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: EmailAddress.sensitiveSchema,
    description: Description.schema,
    amountCents: AmountCents.schema,
  }),
  z.object({
    kind: z.literal("ApprovedExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: EmailAddress.sensitiveSchema,
    description: Description.schema,
    amountCents: AmountCents.schema,
    reviewerId: EmployeeId.schema,
  }),
  z.object({
    kind: z.literal("RejectedExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: EmailAddress.sensitiveSchema,
    description: Description.schema,
    amountCents: AmountCents.schema,
    reviewerId: EmployeeId.schema,
    reason: RejectionReason.schema,
  }),
  z.object({
    kind: z.literal("PaidExpense"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: EmailAddress.sensitiveSchema,
    description: Description.schema,
    amountCents: AmountCents.schema,
    reviewerId: EmployeeId.schema,
    receiptId: ReceiptId.schema,
  }),
]);

type StoredExpense = z.output<typeof StoredExpenseSchema>;
type StoredExpenseJson = z.input<typeof StoredExpenseSchema>;

export const ExpenseCodec = {
  parseStored: (raw: unknown): Expense | undefined => {
    if (raw === undefined) return undefined;
    const parsed = StoredExpenseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("Invalid stored expense");
    }
    return parsed.data;
  },

  toStored: (expense: Expense): StoredExpenseJson => {
    const shared = {
      id: expense.id,
      ownerId: expense.ownerId,
      ownerEmail: expense.ownerEmail.unwrap(),
      description: expense.description,
      amountCents: expense.amountCents,
    };

    switch (expense.kind) {
      case "DraftExpense":
        return {
          kind: "DraftExpense",
          ...shared,
        };
      case "SubmittedExpense":
        return {
          kind: "SubmittedExpense",
          ...shared,
        };
      case "ApprovedExpense":
        return {
          kind: expense.kind,
          ...shared,
          reviewerId: expense.reviewerId,
        };
      case "RejectedExpense":
        return {
          kind: expense.kind,
          ...shared,
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "PaidExpense":
        return {
          kind: expense.kind,
          ...shared,
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
      default:
        return assertNever(expense);
    }
  },
} as const;
