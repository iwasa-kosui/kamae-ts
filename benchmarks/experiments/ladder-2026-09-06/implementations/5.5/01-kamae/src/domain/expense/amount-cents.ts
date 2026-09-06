import * as z from "zod";
import { schemaResult } from "../../shared/validation";

const AmountCentsBrand = Symbol();
const AmountCentsSchema = z
  .number()
  .int()
  .min(1)
  .max(1_000_000)
  .brand<typeof AmountCentsBrand>();

export type AmountCents = z.infer<typeof AmountCentsSchema>;

export const AmountCents = {
  schema: AmountCentsSchema,
  parse: schemaResult(AmountCentsSchema),
} as const;
