import * as z from "zod";

export const ReceiptIdBrand = Symbol();
const ReceiptIdSchema = z.string().min(1).brand<typeof ReceiptIdBrand>();
export type ReceiptId = z.infer<typeof ReceiptIdSchema>;

export const ReceiptId = {
  schema: ReceiptIdSchema,
} as const;
