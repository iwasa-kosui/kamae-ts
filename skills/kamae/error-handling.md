# Error Handling Detailed Guide

## Classify a failure before choosing its representation

Use `Result` to make expected workflow outcomes explicit. Let the application error boundary handle failures for which the workflow has no documented recovery. For library-specific APIs, refer to the corresponding guide in [result-libraries/](./result-libraries/).

| Category | Deciding question | Representation | Owner |
| --- | --- | --- | --- |
| Expected domain failure | Is this a business outcome the caller must choose how to handle? | A use-case-specific discriminated-union error in `Result` | The use case and its caller |
| Recoverable external failure | Does the workflow document how to continue after this external failure? | A named error in that use case's `Result` | The use case and its caller |
| Unexpected infrastructure fault | Is the dependency failure outside a documented recovery decision? | A rejected promise or exception that propagates | The application error boundary |
| Contract or invariant violation | Did code reach a state that its types or contracts say is impossible? | An exception that propagates | The application error boundary and the developer who fixes the defect |

## Use-case-specific Result errors

Define expected domain errors as discriminated unions so callers can handle them exhaustively. Keep each union specific to one use case instead of widening it into a catch-all application error type.

For fp-ts, preserve asynchronous composition with `TaskEither`. Adapt I/O that can reject with `TE.tryCatch`, not `Task`. Carry unexpected faults in a distinct execution channel outside the domain error union, then rethrow the original cause at a native `Promise` boundary after running the pipeline. This transports the fault to its handler without treating it as a recoverable business error. See the [fp-ts guide](./result-libraries/fp-ts.md).

## fromSafePromise Misuse

`ResultAsync.fromSafePromise` (neverthrow) and equivalent "safe" wrappers in other libraries assert that the wrapped Promise **never rejects**. Wrapping a Promise that can reject (database queries, HTTP calls, file I/O) violates that contract: on rejection the error bypasses the Result channel entirely and becomes an unhandled rejection.

```typescript
// Bad: DB call can reject — fromSafePromise swallows that possibility
ResultAsync.fromSafePromise(deps.getDriver(driverId))

// Good only when the workflow specifies how to recover from this failure
ResultAsync.fromPromise(
  deps.getDriver(driverId),
  (cause): GetDriverError => ({ kind: "DriverLookupUnavailable", cause }),
)
```

Use `fromSafePromise` only for Promises that are genuinely infallible — e.g. `Promise.resolve(value)`, in-memory lookups that never throw, or library calls documented to never reject. Use `fromPromise` only when its named error represents a documented recovery decision; otherwise await the operation and let its rejection reach the application error boundary.

## Error Type Design

Define errors as Discriminated Unions so that callers can handle them exhaustively. Each variant should expose contextual data as **typed fields**. A `message` field for logging or display is fine, but it must not be the only place where context values live — callers that need to branch or retry based on those values should not have to parse a string.

```typescript
// Good: context available as typed fields; message is optional and for display only
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId; message?: string }>;

type AssignDriver = (
  command: AssignDriverCommand,
) => Promise<Result<AssignedDriver, AssignDriverError>>;

type RequestStore = Readonly<{
  readonly save: (request: AssignedRequest) => Promise<void>;
}>;

// Bad: driverId and zoneId exist only inside message — callers must parse to extract them
type DriverNotAvailableError = Readonly<{
  kind: "DriverNotAvailableError";
  message: string; // "Driver drv-123 is not available in zone zone-A"
}>;
```

`RequestStore.save` may reject because of an unexpected infrastructure fault, such as a lost database connection; let that rejection reach the application error boundary. Add a named `ExternalServiceError` to `AssignDriverError` only when the workflow specifies a recovery decision, such as retrying, selecting a fallback provider, or asking the caller to try again.

## Compose expected outcomes

Each operation that can produce an expected domain failure returns a `Result`; composition stops at that expected outcome. The composition API differs by library: neverthrow uses `.andThen`, byethrow uses `Result.andThen`, fp-ts uses `E.chain` / `E.bind` for synchronous decisions and `TE.chain` / `TE.bind` (or their widening variants) for asynchronous pipelines, and option-t uses `andThenForResult`.

```typescript
const ensureFound = <T>(id: RequestId) => (
  value: T | undefined,
): Result<T, { readonly kind: "RequestNotFound"; readonly requestId: RequestId }> =>
  value !== undefined
    ? success(value) // ok(), right(), createOk(), etc.
    : failure({ kind: "RequestNotFound", requestId: id });
```

Convert `AssignDriverError` into an HTTP response at the controller boundary by switching on `kind`. The controller owns status-code selection; the use case owns the set of expected errors.

## Contract violations and local control flow

`assertNever` remains appropriate for a contract or invariant violation: it detects a supposedly unreachable branch and lets the resulting exception reach the application error boundary. It must not turn expected domain outcomes into thrown errors.

Private control-flow sentinels are also allowed for a tightly scoped local search only when they are clearer than equivalent `Result` composition. Prefer `Result` when the two forms are equally clear. The catch boundary must identify the one sentinel it owns and rethrow every other error:

```typescript
const foundDriver = Symbol("foundDriver");

type FoundDriver = {
  readonly kind: typeof foundDriver;
  readonly driver: Driver;
};

const isFoundDriver = (error: unknown): error is FoundDriver =>
  typeof error === "object"
  && error !== null
  && "kind" in error
  && error.kind === foundDriver;

const findFirstAvailable = (drivers: readonly Driver[]): Option<Driver> => {
  try {
    drivers.forEach((driver) => {
      if (driver.isAvailable) {
        throw { kind: foundDriver, driver } satisfies FoundDriver;
      }
    });
    return none;
  } catch (error: unknown) {
    if (isFoundDriver(error)) return some(error.driver);
    throw error;
  }
};
```

Thrown validation errors, invalid state transitions, and other expected domain errors remain prohibited: model them as use-case-specific `Result` errors instead.
