import { brandString } from "./brand";
import { err, ok, type Result } from "./result";

declare const EmailAddressBrand: unique symbol;

export type EmailAddress = string & {
  readonly [EmailAddressBrand]: true;
};

export type EmailAddressParseError = Readonly<{
  kind: "EmailAddressParseError";
  message: string;
}>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseError = (message: string): EmailAddressParseError => ({
  kind: "EmailAddressParseError",
  message,
});

export const EmailAddress = {
  parse: (raw: unknown): Result<EmailAddress, EmailAddressParseError> => {
    if (typeof raw !== "string") {
      return err(parseError("Email address must be a string"));
    }

    if (!emailPattern.test(raw)) {
      return err(parseError("Email address is not syntactically valid"));
    }

    return ok(brandString<typeof EmailAddressBrand>(raw));
  },
} as const;
