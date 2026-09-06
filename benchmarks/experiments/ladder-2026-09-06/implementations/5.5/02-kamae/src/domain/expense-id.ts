import * as z from "zod";
import { schemaResult } from "../support/schema-result";

export const ExpenseIdBrand = Symbol();
const ExpenseIdSchema = z.string().min(1).brand<typeof ExpenseIdBrand>();
export type ExpenseId = z.infer<typeof ExpenseIdSchema>;

export const ExpenseId = {
  schema: ExpenseIdSchema,
  parse: schemaResult(ExpenseIdSchema),
} as const;
