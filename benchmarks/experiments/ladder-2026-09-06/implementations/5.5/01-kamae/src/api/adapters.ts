import * as z from "zod";
import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import type { ExpensePaymentGateway } from "../domain/expense/expense-payment-gateway";
import type { ExpenseStore } from "../domain/expense/expense-store";
import type { ExpenseLogger } from "../domain/expense/expense-logger";
import { StorageExpense } from "./storage-expense";
import type { ExpenseServiceDependencies } from "./dependencies";

const PaymentResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paid"), receiptId: z.string() }),
  z.object({ kind: z.literal("declined") }),
]);

export const createAdapters = (
  dependencies: ExpenseServiceDependencies,
): Readonly<{
  resolver: ExpenseByIdResolver;
  store: ExpenseStore;
  paymentGateway: ExpensePaymentGateway;
  logger: ExpenseLogger;
}> => ({
  resolver: {
    findById: async (id) => {
      const raw = await dependencies.repository.get(id);
      if (raw === undefined) {
        return undefined;
      }

      const parsed = StorageExpense.parse(raw);
      if (parsed.isErr()) {
        throw new Error("Stored expense is unusable");
      }
      return parsed.value;
    },
  },

  store: {
    save: async (expense) => {
      await dependencies.repository.save(
        expense.id,
        StorageExpense.fromExpense(expense),
      );
    },
  },

  paymentGateway: {
    charge: async (expense) => {
      const raw = await dependencies.payment.charge({
        expenseId: expense.id,
        amountCents: expense.amountCents,
        email: expense.ownerEmail.unwrap(),
        idempotencyKey: expense.id,
      });
      const parsed = PaymentResultSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error("Payment response is unusable");
      }
      return parsed.data;
    },
  },

  logger: {
    info: (event) => {
      dependencies.logger.info(event);
    },
  },
});
