import { brandString } from "./brand";
import { err, ok, type Result } from "./result";

declare const EmployeeIdBrand: unique symbol;

export type EmployeeId = string & {
  readonly [EmployeeIdBrand]: true;
};

export type EmployeeIdParseError = Readonly<{
  kind: "EmployeeIdParseError";
  message: string;
}>;

const parseError = (message: string): EmployeeIdParseError => ({
  kind: "EmployeeIdParseError",
  message,
});

export const EmployeeId = {
  parse: (raw: unknown): Result<EmployeeId, EmployeeIdParseError> => {
    if (typeof raw !== "string") {
      return err(parseError("Employee id must be a string"));
    }

    if (raw.trim().length === 0) {
      return err(parseError("Employee id must be nonempty"));
    }

    return ok(brandString<typeof EmployeeIdBrand>(raw));
  },
} as const;
