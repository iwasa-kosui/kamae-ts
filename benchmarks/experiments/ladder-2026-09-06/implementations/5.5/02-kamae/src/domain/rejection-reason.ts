import * as z from "zod";
import { schemaResult } from "../support/schema-result";

export const RejectionReasonBrand = Symbol();
const RejectionReasonSchema = z.string().trim().min(1).brand<typeof RejectionReasonBrand>();
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export const RejectionReason = {
  schema: RejectionReasonSchema,
  parse: schemaResult(RejectionReasonSchema),
} as const;
