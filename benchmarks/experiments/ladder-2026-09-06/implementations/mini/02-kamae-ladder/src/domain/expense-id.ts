export const ExpenseIdBrand = Symbol("ExpenseId");

export type ExpenseId = string & {
  readonly [ExpenseIdBrand]: never;
};

const isNonemptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const toExpenseId = (value: string): ExpenseId => value as ExpenseId;

export const ExpenseId = {
  parse: (raw: unknown): ExpenseId | undefined =>
    isNonemptyString(raw) ? toExpenseId(raw) : undefined,
} as const;
