declare const EmailAddressBrand: unique symbol;

export type EmailAddress = string & { readonly [EmailAddressBrand]: never };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailAddress = {
  of: (value: string): EmailAddress => value as EmailAddress,
  parse: (raw: unknown): EmailAddress | undefined =>
    typeof raw === "string" && emailPattern.test(raw) ? EmailAddress.of(raw) : undefined,
} as const;
