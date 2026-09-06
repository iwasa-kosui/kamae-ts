declare const ExpenseIdBrand: unique symbol;

export type ExpenseId = string & { readonly [ExpenseIdBrand]: never };

export const ExpenseId = {
  of: (value: string): ExpenseId => value as ExpenseId,
  parse: (raw: unknown): ExpenseId | undefined =>
    typeof raw === "string" && raw.length > 0 ? ExpenseId.of(raw) : undefined,
} as const;
