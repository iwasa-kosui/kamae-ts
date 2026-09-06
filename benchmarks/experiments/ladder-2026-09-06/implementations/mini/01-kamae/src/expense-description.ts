import { brandString } from "./brand";
import { err, ok, type Result } from "./result";

declare const ExpenseDescriptionBrand: unique symbol;

export type ExpenseDescription = string & {
  readonly [ExpenseDescriptionBrand]: true;
};

export type ExpenseDescriptionParseError = Readonly<{
  kind: "ExpenseDescriptionParseError";
  message: string;
}>;

const parseError = (message: string): ExpenseDescriptionParseError => ({
  kind: "ExpenseDescriptionParseError",
  message,
});

export const ExpenseDescription = {
  parse: (raw: unknown): Result<ExpenseDescription, ExpenseDescriptionParseError> => {
    if (typeof raw !== "string") {
      return err(parseError("Expense description must be a string"));
    }

    if (raw.trim().length === 0) {
      return err(parseError("Expense description must contain non-whitespace text"));
    }

    return ok(brandString<typeof ExpenseDescriptionBrand>(raw));
  },
} as const;
