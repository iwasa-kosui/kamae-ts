import { err, ok, type Result } from "neverthrow";
import * as z from "zod";

export type ValidationError = Readonly<{
  kind: "ValidationError";
}>;

export const schemaResult =
  <Output, Input>(schema: z.ZodType<Output, z.ZodTypeDef, Input>) =>
  (raw: unknown): Result<Output, ValidationError> => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? ok(parsed.data) : err({ kind: "ValidationError" });
  };

export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};
