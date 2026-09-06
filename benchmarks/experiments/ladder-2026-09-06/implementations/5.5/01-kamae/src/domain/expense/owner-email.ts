import * as z from "zod";
import { Sensitive } from "../../shared/sensitive";
import { schemaResult } from "../../shared/validation";

const OwnerEmailBrand = Symbol();
const OwnerEmailStringSchema = z
  .string()
  .email()
  .brand<typeof OwnerEmailBrand>();
const OwnerEmailSchema = OwnerEmailStringSchema.transform(Sensitive.of);

export type OwnerEmail = z.infer<typeof OwnerEmailStringSchema>;
export type SensitiveOwnerEmail = z.infer<typeof OwnerEmailSchema>;

export const OwnerEmail = {
  schema: OwnerEmailSchema,
  storageSchema: OwnerEmailStringSchema,
  parse: schemaResult(OwnerEmailSchema),
} as const;
