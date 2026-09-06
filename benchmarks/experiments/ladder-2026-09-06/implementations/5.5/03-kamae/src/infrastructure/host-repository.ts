import type { ExpenseByIdResolver } from "../domain/expense/expense-by-id-resolver";
import { ExpenseCodec } from "../domain/expense/expense-codec";
import type { ExpenseStore } from "../domain/expense/expense-store";

export type HostRepository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: unknown) => Promise<void>;
}>;

export const createHostExpenseResolver = (
  repository: HostRepository,
): ExpenseByIdResolver => ({
  findById: async (id) => ExpenseCodec.parseStored(await repository.get(id)),
});

export const createHostExpenseStore = (
  repository: HostRepository,
): ExpenseStore => ({
  save: async (expense) => {
    await repository.save(expense.id, ExpenseCodec.toStored(expense));
  },
});

