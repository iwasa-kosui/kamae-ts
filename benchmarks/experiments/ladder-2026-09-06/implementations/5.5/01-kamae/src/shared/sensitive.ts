export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => {
    const wrapper = {
      unwrap: () => value,
      toJSON: () => "[REDACTED]",
      toString: () => "[REDACTED]",
    };
    Object.defineProperty(wrapper, Symbol.for("nodejs.util.inspect.custom"), {
      value: () => "[REDACTED]",
    });
    return wrapper;
  },
} as const;
