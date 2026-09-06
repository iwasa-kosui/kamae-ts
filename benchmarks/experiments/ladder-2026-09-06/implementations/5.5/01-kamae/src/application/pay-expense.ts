import { err, ok, type Result } from "neverthrow";
import type { PayCommand } from "../api/commands";
import { Expense, type PaidExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseLogger } from "../domain/expense/expense-logger";
import type { ExpensePaymentGateway } from "../domain/expense/expense-payment-gateway";
import type { ExpenseStore } from "../domain/expense/expense-store";
import { ReceiptId } from "../domain/expense/receipt-id";

export type PayExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "UnavailableOperation" }>
  | Readonly<{ kind: "PaymentDeclined" }>;

export const payExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    paymentGateway: ExpensePaymentGateway,
    logger: ExpenseLogger,
  ) =>
  async (command: PayCommand): Promise<Result<PaidExpense, PayExpenseError>> => {
    const expense = await resolver.findById(command.id);
    if (expense === undefined) {
      return err({ kind: "MissingExpense" });
    }
    if (expense.kind === "Paid") {
      return ok(expense);
    }
    if (expense.kind !== "Approved") {
      return err({ kind: "UnavailableOperation" });
    }

    const payment = await paymentGateway.charge(expense);
    if (payment.kind === "declined") {
      return err({ kind: "PaymentDeclined" });
    }

    const receiptId = ReceiptId.schema.safeParse(payment.receiptId);
    if (!receiptId.success) {
      throw new Error("Payment receipt is unusable");
    }

    const paid = Expense.markPaid(expense, receiptId.data);
    await store.save(paid);
    logger.info({ expenseId: paid.id, action: "paid" });
    return ok(paid);
  };
