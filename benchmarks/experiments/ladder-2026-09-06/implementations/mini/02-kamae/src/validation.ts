import { Result, type Result as ResultType } from "./result";

export type ValidationError = Readonly<{
  code: "invalid_command";
}>;

const invalidCommandError = { code: "invalid_command" } as const satisfies ValidationError;

export const invalidCommand = (): ValidationError => invalidCommandError;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseString = (value: unknown): ResultType<string, ValidationError> =>
  typeof value === "string" ? Result.ok(value) : Result.err(invalidCommand());

export const parseNonemptyString = (value: unknown): ResultType<string, ValidationError> => {
  if (typeof value !== "string") {
    return Result.err(invalidCommand());
  }

  return value.trim().length > 0 ? Result.ok(value) : Result.err(invalidCommand());
};

export const parsePositiveInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
): ResultType<number, ValidationError> => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return Result.err(invalidCommand());
  }

  return value >= minimum && value <= maximum ? Result.ok(value) : Result.err(invalidCommand());
};

export const parseEmailAddress = (value: unknown): ResultType<string, ValidationError> => {
  if (typeof value !== "string") {
    return Result.err(invalidCommand());
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value) ? Result.ok(value) : Result.err(invalidCommand());
};

