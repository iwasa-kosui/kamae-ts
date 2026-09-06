import { err, ok, type Result } from "neverthrow";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { ExpenseLogger } from "../domain/expense/expense-logger";
import { Expense, type DraftExpense } from "../domain/expense/expense";
import type { CreateCommand } from "../api/commands";

export type CreateExpenseError = Readonly<{ kind: "DuplicateExpense" }>;

export const createExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    logger: ExpenseLogger,
  ) =>
  async (
    command: CreateCommand,
  ): Promise<Result<DraftExpense, CreateExpenseError>> => {
    const existing = await resolver.findById(command.id);
    if (existing !== undefined) {
      return err({ kind: "DuplicateExpense" });
    }

    const expense = Expense.create({
      id: command.id,
      ownerId: command.ownerId,
      ownerEmail: command.ownerEmail,
      description: command.description,
      amountCents: command.amountCents,
    });
    await store.save(expense);
    logger.info({ expenseId: expense.id, action: "created", actorId: expense.ownerId });
    return ok(expense);
  };
