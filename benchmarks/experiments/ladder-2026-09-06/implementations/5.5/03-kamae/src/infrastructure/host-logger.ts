import type { ExpenseLogger } from "../application/logger";

export type HostLogger = Readonly<{
  info: (event: unknown) => void;
}>;

export const createHostExpenseLogger = (
  logger: HostLogger,
): ExpenseLogger => ({
  record: (event) => {
    logger.info({
      expenseId: event.expenseId,
      action: event.action,
    });
  },
});

