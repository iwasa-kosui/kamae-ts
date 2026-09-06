import * as z from "zod";

export const ExpenseIdBrand = Symbol();
const ExpenseIdSchema = z.string().min(1).brand<typeof ExpenseIdBrand>();
export type ExpenseId = z.infer<typeof ExpenseIdSchema>;

export const ExpenseId = {
  schema: ExpenseIdSchema,
} as const;
