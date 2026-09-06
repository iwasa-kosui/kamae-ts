import { brandString } from "./brand";
import { err, ok, type Result } from "./result";

declare const ExpenseIdBrand: unique symbol;

export type ExpenseId = string & {
  readonly [ExpenseIdBrand]: true;
};

export type ExpenseIdParseError = Readonly<{
  kind: "ExpenseIdParseError";
  message: string;
}>;

const parseError = (message: string): ExpenseIdParseError => ({
  kind: "ExpenseIdParseError",
  message,
});

export const ExpenseId = {
  parse: (raw: unknown): Result<ExpenseId, ExpenseIdParseError> => {
    if (typeof raw !== "string") {
      return err(parseError("Expense id must be a string"));
    }

    if (raw.trim().length === 0) {
      return err(parseError("Expense id must be nonempty"));
    }

    return ok(brandString<typeof ExpenseIdBrand>(raw));
  },
} as const;
