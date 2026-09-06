import * as z from "zod";
import { handleCommand } from "./api/handle-command";
import { ReceiptId } from "./domain/receipt-id";
import { ExpenseRecordMapper } from "./storage/expense-record-mapper";

const HostPaymentResult = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paid"), receiptId: ReceiptId.schema }),
  z.object({ kind: z.literal("declined") }),
]);

export type HostRepository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

export type HostPayment = Readonly<{
  charge: (request: {
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }) => Promise<unknown>;
}>;

export type HostLogger = Readonly<{
  info: (event: unknown) => void;
}>;

export type ExpenseServiceDependencies = Readonly<{
  repository: HostRepository;
  payment: HostPayment;
  logger: HostLogger;
}>;

export type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<Awaited<ReturnType<ReturnType<typeof handleCommand>>>>;
}>;

export const createExpenseService = (
  dependencies: ExpenseServiceDependencies,
): ExpenseService => {
  const resolver = {
    findById: async (id) => {
      const raw = await dependencies.repository.get(id);
      if (raw === undefined) {
        return undefined;
      }
      return ExpenseRecordMapper.fromStored(raw).match(
        (expense) => expense,
        () => {
          throw new Error("Invalid stored expense");
        },
      );
    },
  } satisfies Parameters<typeof handleCommand>[0]["resolver"];

  const store = {
    save: async (expense) => {
      await dependencies.repository.save(expense.id, ExpenseRecordMapper.toStored(expense));
    },
  } satisfies Parameters<typeof handleCommand>[0]["store"];

  const payment = {
    charge: async (request) => {
      const rawResult = await dependencies.payment.charge({
        expenseId: request.expenseId,
        amountCents: request.amountCents,
        email: request.email,
        idempotencyKey: request.idempotencyKey,
      });
      const parsed = HostPaymentResult.safeParse(rawResult);
      if (!parsed.success) {
        throw new Error("Invalid payment response");
      }
      return parsed.data;
    },
  } satisfies Parameters<typeof handleCommand>[0]["payment"];

  const logger = {
    info: (event) => {
      dependencies.logger.info({ expenseId: event.expenseId, action: event.action });
    },
  } satisfies Parameters<typeof handleCommand>[0]["logger"];

  return {
    handle: handleCommand({ resolver, store, payment, logger }),
  };
};
