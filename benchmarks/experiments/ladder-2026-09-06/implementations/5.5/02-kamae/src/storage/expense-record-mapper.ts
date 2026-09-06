import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import type { Expense } from "../domain/expense";
import { Sensitive } from "../domain/sensitive";
import { StoredExpense, StoredExpenseParser } from "./stored-expense";

export type StoredExpenseError = Readonly<{
  kind: "InvalidStoredExpense";
}>;

export const ExpenseRecordMapper = {
  toStored: (expense: Expense): StoredExpense => {
    const common = {
      schemaVersion: 1,
      id: expense.id,
      ownerId: expense.ownerId,
      ownerEmail: expense.ownerEmail.unwrap(),
      description: expense.description,
      amountCents: expense.amountCents,
    } as const;

    switch (expense.kind) {
      case "DraftExpense":
        return { ...common, kind: "DraftExpense" };
      case "SubmittedExpense":
        return { ...common, kind: "SubmittedExpense" };
      case "ApprovedExpense":
        return { ...common, kind: "ApprovedExpense", reviewerId: expense.reviewerId };
      case "RejectedExpense":
        return {
          ...common,
          kind: "RejectedExpense",
          reviewerId: expense.reviewerId,
          reason: expense.reason,
        };
      case "PaidExpense":
        return {
          ...common,
          kind: "PaidExpense",
          reviewerId: expense.reviewerId,
          receiptId: expense.receiptId,
        };
    }
  },

  fromStored: (raw: unknown): Result<Expense, StoredExpenseError> =>
    StoredExpenseParser.parse(raw).match(
      (stored) => {
        const common = {
          id: stored.id,
          ownerId: stored.ownerId,
          ownerEmail: Sensitive.of(stored.ownerEmail),
          description: stored.description,
          amountCents: stored.amountCents,
        } as const;

        switch (stored.kind) {
          case "DraftExpense":
            return ok({ kind: "DraftExpense", ...common });
          case "SubmittedExpense":
            return ok({ kind: "SubmittedExpense", ...common });
          case "ApprovedExpense":
            return ok({ kind: "ApprovedExpense", ...common, reviewerId: stored.reviewerId });
          case "RejectedExpense":
            return ok({
              kind: "RejectedExpense",
              ...common,
              reviewerId: stored.reviewerId,
              reason: stored.reason,
            });
          case "PaidExpense":
            return ok({
              kind: "PaidExpense",
              ...common,
              reviewerId: stored.reviewerId,
              receiptId: stored.receiptId,
            });
        }
      },
      () => err({ kind: "InvalidStoredExpense" }),
    ),
} as const;
