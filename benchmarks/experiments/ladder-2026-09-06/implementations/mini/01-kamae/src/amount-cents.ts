import { brandNumber } from "./brand";
import { err, ok, type Result } from "./result";

declare const AmountCentsBrand: unique symbol;

export type AmountCents = number & {
  readonly [AmountCentsBrand]: true;
};

export type AmountCentsParseError = Readonly<{
  kind: "AmountCentsParseError";
  message: string;
}>;

const parseError = (message: string): AmountCentsParseError => ({
  kind: "AmountCentsParseError",
  message,
});

export const AmountCents = {
  parse: (raw: unknown): Result<AmountCents, AmountCentsParseError> => {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      return err(parseError("Amount must be an integer"));
    }

    if (raw < 1 || raw > 1_000_000) {
      return err(parseError("Amount must be between 1 and 1000000 cents"));
    }

    return ok(brandNumber<typeof AmountCentsBrand>(raw));
  },
} as const;
