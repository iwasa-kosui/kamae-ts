export const EmailAddressBrand = Symbol("EmailAddress");

export type EmailAddress = string & {
  readonly [EmailAddressBrand]: never;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toEmailAddress = (value: string): EmailAddress => value as EmailAddress;

export const EmailAddress = {
  parse: (raw: unknown): EmailAddress | undefined =>
    typeof raw === "string" && emailPattern.test(raw) ? toEmailAddress(raw) : undefined,
} as const;
