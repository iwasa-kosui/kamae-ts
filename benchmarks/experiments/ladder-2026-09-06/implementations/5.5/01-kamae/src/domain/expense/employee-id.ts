import * as z from "zod";
import { schemaResult } from "../../shared/validation";

const EmployeeIdBrand = Symbol();
const EmployeeIdSchema = z.string().min(1).brand<typeof EmployeeIdBrand>();

export type EmployeeId = z.infer<typeof EmployeeIdSchema>;

export const EmployeeId = {
  schema: EmployeeIdSchema,
  parse: schemaResult(EmployeeIdSchema),
} as const;
