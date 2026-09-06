export type Ok<T> = Readonly<{
  kind: "ok";
  value: T;
}>;

export type Err<E> = Readonly<{
  kind: "err";
  error: E;
}>;

export type Result<T, E> = Ok<T> | Err<E>;

export const Result = {
  ok: <T>(value: T): Ok<T> => ({ kind: "ok", value }),
  err: <E>(error: E): Err<E> => ({ kind: "err", error }),
  isOk: <T, E>(result: Result<T, E>): result is Ok<T> => result.kind === "ok",
  isErr: <T, E>(result: Result<T, E>): result is Err<E> => result.kind === "err",
} as const;

