import { err, ok, type Result } from "neverthrow";
import * as z from "zod";

export type ValidationError = Readonly<{
  kind: "ValidationError";
}>;

export const schemaResult =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema.safeParse(raw);
    return result.success ? ok(result.data) : err({ kind: "ValidationError" });
  };

