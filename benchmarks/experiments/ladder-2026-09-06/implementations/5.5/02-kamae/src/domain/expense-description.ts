import * as z from "zod";
import { schemaResult } from "../support/schema-result";

export const ExpenseDescriptionBrand = Symbol();
const ExpenseDescriptionSchema = z
  .string()
  .trim()
  .min(1)
  .brand<typeof ExpenseDescriptionBrand>();
export type ExpenseDescription = z.infer<typeof ExpenseDescriptionSchema>;

export const ExpenseDescription = {
  schema: ExpenseDescriptionSchema,
  parse: schemaResult(ExpenseDescriptionSchema),
} as const;
