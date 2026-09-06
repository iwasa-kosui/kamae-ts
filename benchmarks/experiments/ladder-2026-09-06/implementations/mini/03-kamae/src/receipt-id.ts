declare const ReceiptIdBrand: unique symbol;

export type ReceiptId = string & { readonly [ReceiptIdBrand]: never };

export const ReceiptId = {
  of: (value: string): ReceiptId => value as ReceiptId,
  parse: (raw: unknown): ReceiptId | undefined =>
    typeof raw === "string" && raw.length > 0 ? ReceiptId.of(raw) : undefined,
} as const;
