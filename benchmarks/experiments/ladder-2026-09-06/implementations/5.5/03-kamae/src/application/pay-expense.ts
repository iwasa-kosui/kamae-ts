import { err, ok, type Result } from "neverthrow";
import { Expense, type PaidExpense } from "../domain/expense/expense";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { ExpenseId } from "../domain/expense/expense-id";
import type { ExpenseLogger } from "./logger";
import type { PaymentCharger } from "./payment-charger";

export type PayExpenseError =
  | Readonly<{ kind: "MissingExpense" }>
  | Readonly<{ kind: "InvalidStage" }>
  | Readonly<{ kind: "PaymentDeclined" }>;

export const payExpense =
  (
    resolver: ExpenseByIdResolver,
    store: ExpenseStore,
    payment: PaymentCharger,
    logger: ExpenseLogger,
  ) =>
  async (id: ExpenseId): Promise<Result<PaidExpense, PayExpenseError>> => {
    const expense = await resolver.findById(id);
    if (expense === undefined) return err({ kind: "MissingExpense" });
    if (expense.kind === "PaidExpense") return ok(expense);
    if (expense.kind !== "ApprovedExpense") return err({ kind: "InvalidStage" });

    const paymentResult = await payment.charge({
      expenseId: expense.id,
      amountCents: expense.amountCents,
      email: expense.ownerEmail.unwrap(),
      idempotencyKey: expense.id,
    });

    if (paymentResult.kind === "declined") {
      return err({ kind: "PaymentDeclined" });
    }

    const paid = Expense.markPaid(expense, paymentResult.receiptId);
    await store.save(paid);
    logger.record({ expenseId: paid.id, action: "paid" });
    return ok(paid);
  };

