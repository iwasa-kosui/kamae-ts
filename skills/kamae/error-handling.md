# Error Handling Detailed Guide

## Railway Oriented Programming

Use Result types to represent success and failure in the type system. Do not throw exceptions in the domain layer. For library-specific APIs, refer to the corresponding guide in [result-libraries/](./result-libraries/).

## Error Type Design

Define errors as Discriminated Unions so that callers can handle them exhaustively.

```typescript
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;
```

### Error Type Granularity

The error type returned by each use case should be specific to that use case. Stuffing everything into a common error type (`AppError`) makes it impossible for callers to determine from the type which errors can actually occur.

```typescript
// Good: use case-specific error types
type AssignDriverError = RequestNotFoundError | InvalidStateError | DriverNotAvailableError;
type StartTripError = RequestNotFoundError | InvalidStateError;

// Bad: stuffing all errors into one type
type AppError = RequestNotFoundError | InvalidStateError | DriverNotAvailableError | ...;
```

## Composing Operations

Each step returns a Result type, and if an error occurs, subsequent steps are skipped. The composition API differs by library (neverthrow/byethrow use `.andThen()`, fp-ts uses `pipe` + `chain`, option-t uses `flatMapForResult`).

### Helper Functions

Extract common validation into small functions and use them as composition steps.

```typescript
// Helper return values are Result types. The specific API (ok/err, right/left, etc.) depends on the library
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

## Error Conversion in the Controller Layer

Converting domain errors to HTTP responses is the responsibility of the Controller layer. Determine the status code based on the domain error's `kind`.

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

## Where Exceptions Are Appropriate

Do not throw exceptions in the domain layer, but exceptions are appropriate in these places:

- `assertNever`: detecting unreachable code (programming bugs)
- Unexpected infrastructure failures (e.g., DB connection loss) — delegate these to the framework's error handler
