import { err, ok, type Result } from "./result";

export type ParseError = Readonly<{
  kind: "ParseError";
  field?: string;
  message: string;
}>;

export const parseError = (message: string, field?: string): ParseError => ({
  kind: "ParseError",
  field,
  message,
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readStringField = (
  record: Record<string, unknown>,
  field: string,
): Result<string, ParseError> => {
  const value = record[field];
  if (typeof value !== "string") {
    return err(parseError(`Expected ${field} to be a string`, field));
  }

  return ok(value);
};

export const readUnknownField = (
  record: Record<string, unknown>,
  field: string,
): Result<unknown, ParseError> => {
  if (!(field in record)) {
    return err(parseError(`Missing required field ${field}`, field));
  }

  return ok(record[field]);
};

export const readIntegerField = (
  record: Record<string, unknown>,
  field: string,
): Result<number, ParseError> => {
  const value = record[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return err(parseError(`Expected ${field} to be an integer`, field));
  }

  return ok(value);
};

export const readNonEmptyStringField = (
  record: Record<string, unknown>,
  field: string,
): Result<string, ParseError> => {
  const result = readStringField(record, field);
  if (result.kind === "err") {
    return result;
  }

  return result.value.trim().length > 0
    ? ok(result.value)
    : err(parseError(`Expected ${field} to contain non-whitespace text`, field));
};
