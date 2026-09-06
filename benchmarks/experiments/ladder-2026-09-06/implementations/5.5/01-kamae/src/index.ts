import { createHandle } from "./api/handle";
import type { ExpenseServiceDependencies } from "./api/dependencies";

export type { ExpenseServiceDependencies } from "./api/dependencies";
export type { HandleResponse } from "./api/responses";

export const createExpenseService = (
  dependencies: ExpenseServiceDependencies,
): Readonly<{
  handle: (command: unknown) => Promise<import("./api/responses").HandleResponse>;
}> => ({
  handle: createHandle(dependencies),
});
