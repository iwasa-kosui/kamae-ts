export type Result<Success, Failure> =
  | Readonly<{ kind: "ok"; value: Success }>
  | Readonly<{ kind: "err"; error: Failure }>;

export const ok = <Success, Failure = never>(value: Success): Result<Success, Failure> => ({
  kind: "ok",
  value,
});

export const err = <Success = never, Failure = never>(error: Failure): Result<Success, Failure> => ({
  kind: "err",
  error,
});

export const isOk = <Success, Failure>(
  result: Result<Success, Failure>,
): result is Readonly<{ kind: "ok"; value: Success }> => result.kind === "ok";
