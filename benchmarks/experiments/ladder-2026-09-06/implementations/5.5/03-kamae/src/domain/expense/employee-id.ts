import * as z from "zod";
import { schemaResult } from "./validation";

export const EmployeeIdBrand = Symbol();

const EmployeeIdSchema = z
  .string()
  .refine((value) => value.trim().length > 0)
  .brand<typeof EmployeeIdBrand>();

export type EmployeeId = z.infer<typeof EmployeeIdSchema>;

export const EmployeeId = {
  schema: EmployeeIdSchema,
  parse: schemaResult(EmployeeIdSchema),
} as const;

