---
title: Error Handling
parent: English
nav_order: 3
has_children: true
---

# Error Handling — Detailed Guide

## Railway Oriented Programming

Use Result types to represent success and failure as values. Do not throw exceptions in the domain layer. For library-specific APIs, refer to the relevant guide under [result-libraries/](./result-libraries/).

## fromSafePromise Misuse

`ResultAsync.fromSafePromise` (neverthrow) and equivalent "safe" wrappers in other libraries assert that the wrapped Promise **never rejects**. Wrapping a Promise that can reject (database queries, HTTP calls, file I/O) violates that contract: on rejection the error bypasses the Result channel entirely and becomes an unhandled rejection.

```typescript
// Bad: DB call can reject — fromSafePromise swallows that possibility
ResultAsync.fromSafePromise(deps.getDriver(driverId))

// Good: fromPromise with an explicit error mapper
ResultAsync.fromPromise(
  deps.getDriver(driverId),
  (cause): RepositoryError => ({ kind: "RepositoryError", cause }),
)
```

Use `fromSafePromise` only for Promises that are genuinely infallible — e.g. `Promise.resolve(value)`, in-memory lookups that never throw, or library calls documented to never reject.

## Designing Error Types

Define error types as Discriminated Unions so callers can handle them exhaustively. Each variant should expose contextual data as **typed fields**. A `message` field for logging or display is fine, but it must not be the only place where context values live — callers that need to branch or retry based on those values should not have to parse a string.

```typescript
// Good: context available as typed fields; message is optional and for display only
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId; message?: string }>;

// Bad: driverId and zoneId exist only inside message — callers must parse to extract them
type DriverNotAvailableError = Readonly<{
  kind: "DriverNotAvailableError";
  message: string; // "Driver drv-123 is not available in zone zone-A"
}>;
```

### Error Type Granularity

Each use case should return an error type specific to that use case. Stuffing everything into a shared `AppError` type makes it impossible for callers to determine from the types alone which errors can actually occur.

```typescript
// Good: use-case-specific error types
type AssignDriverError = RequestNotFoundError | InvalidStateError | DriverNotAvailableError;
type StartTripError = RequestNotFoundError | InvalidStateError;

// Bad: cramming all errors into one type
type AppError = RequestNotFoundError | InvalidStateError | DriverNotAvailableError | ...;
```

## Composing Operations

Each step returns a Result type, and if an error occurs at any step the remaining steps are skipped. The composition API differs by library (`.andThen()` in neverthrow/byethrow, `pipe` + `chain` in fp-ts, `flatMapForResult` in option-t).

### Helper Functions

Extract common validations into small functions and use them as individual composition steps.

```typescript
// Helper return type is Result. The specific API (ok/err, right/left, etc.) depends on the library.
const ensureFound = <T>(id: RequestId) => (
  value: T | undefined,
): Result<T, RequestNotFoundError> =>
  value !== undefined
    ? success(value)   // ok(), right(), createOk(), etc.
    : failure({ kind: "RequestNotFound", requestId: id });

const ensureWaiting = (
  request: TaxiRequest,
): Result<Waiting, InvalidStateError> =>
  request.kind === "Waiting"
    ? success(request)
    : failure({ kind: "InvalidState", currentKind: request.kind, expectedKind: "Waiting" });
```

## Translating Errors in the Controller Layer

Mapping domain errors to HTTP responses is the responsibility of the controller layer. Determine the status code based on the `kind` of the domain error.

```typescript
const toHttpResponse = (error: AssignDriverError): Response => {
  switch (error.kind) {
    case "RequestNotFound":
      return notFound(`Request ${error.requestId} not found`);
    case "InvalidState":
      return conflict(`Expected ${error.expectedKind}, got ${error.currentKind}`);
    case "DriverNotAvailable":
      return unprocessableEntity(`Driver ${error.driverId} is not available`);
    default:
      return assertNever(error);
  }
};
```

## When Exceptions Are Appropriate

The domain layer does not throw exceptions, but the following are legitimate uses:

- `assertNever`: detecting unreachable code (programming bugs)
- Unexpected infrastructure failures (e.g. dropped DB connections) — delegate these to the framework's error handler
