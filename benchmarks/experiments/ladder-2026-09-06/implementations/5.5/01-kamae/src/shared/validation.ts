import { err, ok, type Result } from "neverthrow";
import * as z from "zod";

export type ValidationError = Readonly<{
  kind: "ValidationError";
}>;

export const schemaResult =
  <T>(schema: z.ZodType<T, unknown>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? ok(parsed.data) : err({ kind: "ValidationError" });
  };
