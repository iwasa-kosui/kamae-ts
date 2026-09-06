import * as z from "zod";

export const EmployeeIdBrand = Symbol();
const EmployeeIdSchema = z.string().min(1).brand<typeof EmployeeIdBrand>();
export type EmployeeId = z.infer<typeof EmployeeIdSchema>;

export const EmployeeId = {
  schema: EmployeeIdSchema,
} as const;
