import * as z from "zod";
import { schemaResult } from "./validation";

export const ReceiptIdBrand = Symbol();

const ReceiptIdSchema = z
  .string()
  .refine((value) => value.trim().length > 0)
  .brand<typeof ReceiptIdBrand>();

export type ReceiptId = z.infer<typeof ReceiptIdSchema>;

export const ReceiptId = {
  schema: ReceiptIdSchema,
  parse: schemaResult(ReceiptIdSchema),
} as const;

