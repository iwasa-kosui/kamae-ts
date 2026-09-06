import * as z from "zod";
import { schemaResult } from "../result";

const PaymentResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paid"),
    receiptId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("declined"),
  }),
]);

export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;

export const PaymentResponse = {
  schema: PaymentResponseSchema,
  parse: schemaResult(PaymentResponseSchema),
} as const;
