import { err, ok, type Result } from "neverthrow";
import { Expense, type PaidExpense } from "../domain/expense";
import type { DiagnosticLogger } from "../domain/diagnostic-logger";
import type { ExpenseId } from "../domain/expense-id";
import type { ExpenseByIdResolver } from "../domain/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense-store";
import type { PaymentGateway } from "../domain/payment-gateway";

export type PayExpenseError =
  | Readonly<{ kind: "ExpenseNotFound"; expenseId: ExpenseId }>
  | Readonly<{ kind: "UnavailableStage"; expenseId: ExpenseId }>
  | Readonly<{ kind: "PaymentDeclined"; expenseId: ExpenseId }>;

export const payExpenseUseCase =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    payment: PaymentGateway,
    logger: DiagnosticLogger,
  ) =>
  async (id: ExpenseId): Promise<Result<PaidExpense, PayExpenseError>> => {
    const expense = await resolver.findById(id);
    if (expense === undefined) {
      return err({ kind: "ExpenseNotFound", expenseId: id });
    }
    if (expense.kind === "PaidExpense") {
      return ok(expense);
    }
    if (expense.kind !== "ApprovedExpense") {
      return err({ kind: "UnavailableStage", expenseId: id });
    }

    const paymentResult = await payment.charge({
      expenseId: expense.id,
      amountCents: expense.amountCents,
      email: expense.ownerEmail.unwrap(),
      idempotencyKey: expense.id,
    });
    if (paymentResult.kind === "declined") {
      return err({ kind: "PaymentDeclined", expenseId: id });
    }

    const paid = Expense.markPaid(expense, paymentResult.receiptId);
    await store.save(paid);
    logger.info({ expenseId: paid.id, action: "pay" });
    return ok(paid);
  };
