import * as z from "zod";
import { schemaResult } from "../support/schema-result";
import { Sensitive } from "./sensitive";

export const OwnerEmailBrand = Symbol();
const OwnerEmailValueSchema = z.email().brand<typeof OwnerEmailBrand>();
export type OwnerEmail = z.infer<typeof OwnerEmailValueSchema>;

const OwnerEmailSchema = Sensitive.schema(OwnerEmailValueSchema);

export const OwnerEmail = {
  schema: OwnerEmailSchema,
  valueSchema: OwnerEmailValueSchema,
  parse: schemaResult(OwnerEmailSchema),
} as const;
