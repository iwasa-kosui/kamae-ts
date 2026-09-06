const inspectCustom = Symbol.for("nodejs.util.inspect.custom");

export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
  [inspectCustom]: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [inspectCustom]: () => "[REDACTED]",
  }),
} as const;

