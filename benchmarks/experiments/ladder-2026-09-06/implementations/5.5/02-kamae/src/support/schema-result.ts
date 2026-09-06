import { err, ok, type Result } from "neverthrow";
import type * as z from "zod";

export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<unknown>;
}>;

export const schemaResult =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      return err({ kind: "ValidationError", issues: result.error.issues });
    }
    return ok(result.data);
  };
