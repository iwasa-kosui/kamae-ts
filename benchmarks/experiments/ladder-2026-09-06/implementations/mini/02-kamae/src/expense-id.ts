import { Result, type Result as ResultType } from "./result";
import { invalidCommand, parseString } from "./validation";
export type ExpenseId = string;

const parseExpenseId = (value: unknown): ResultType<ExpenseId, ReturnType<typeof invalidCommand>> => {
  const parsed = parseString(value);
  if (Result.isErr(parsed) || parsed.value.length === 0) {
    return Result.err(invalidCommand());
  }

  return Result.ok(parsed.value);
};

export const ExpenseId = {
  parse: parseExpenseId,
} as const;
