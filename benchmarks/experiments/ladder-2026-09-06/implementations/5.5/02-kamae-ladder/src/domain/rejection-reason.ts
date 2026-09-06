import * as z from "zod";

export const RejectionReasonBrand = Symbol();
const RejectionReasonSchema = z.string().refine((value) => value.trim().length > 0).brand<typeof RejectionReasonBrand>();
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export const RejectionReason = {
  schema: RejectionReasonSchema,
} as const;
