import * as z from "zod";
import { schemaResult } from "./validation";

export const ExpenseIdBrand = Symbol();

const ExpenseIdSchema = z
  .string()
  .refine((value) => value.trim().length > 0)
  .brand<typeof ExpenseIdBrand>();

export type ExpenseId = z.infer<typeof ExpenseIdSchema>;

export const ExpenseId = {
  schema: ExpenseIdSchema,
  parse: schemaResult(ExpenseIdSchema),
} as const;

