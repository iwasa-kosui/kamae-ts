# neverthrow

## Basic API

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow";
```

| Function/Type | Description |
|---------|------|
| `Result<T, E>` | Synchronous Result type |
| `ResultAsync<T, E>` | Asynchronous Result type (wrapper around Promise<Result>) |
| `ok(value)` | Creates a success value |
| `err(error)` | Creates a failure value |
| `.andThrough(fn)` | Executes a side effect and returns the original value on success |

## Chaining Methods

```typescript
result
  .map((value) => transform(value))         // Transform the success value
  .mapErr((error) => transformErr(error))    // Transform the error value
  .andThen((value) => nextResult(value))     // Chain to the next Result from a success value (flatMap)
  .andThrough((value) => sideEffect(value))  // Execute a side effect and return the original value on success
  .orElse((error) => recover(error))         // Recover from an error
  .match(
    (value) => handleOk(value),
    (error) => handleErr(error),
  );
```

## Code Example: State Transition Pipeline

Following Railway Oriented Programming principles, extract each expected business decision into an independent function, and compose them with method chaining. Persist only after the decision succeeds so a rejected promise remains an unexpected failure.

For the design of `RequestResolver` / `RequestStore` and how domain events are persisted atomically with state, see [state-modeling.md#domain-events](../state-modeling.md#domain-events).

```typescript
import { ok, err, Result } from "neverthrow";

// --- Branded Types ---

declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };

declare const DriverIdBrand: unique symbol;
type DriverId = string & { readonly [DriverIdBrand]: never };

declare const PassengerIdBrand: unique symbol;
type PassengerId = string & { readonly [PassengerIdBrand]: never };

// --- State Types ---

type Waiting = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
  passengerId: PassengerId;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
}>;

// --- Repository Types ---

type RequestResolver = Readonly<{
  findById: (id: RequestId) => Promise<Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => Promise<void>;
}>;

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

// --- Domain Functions ---

const ensureExists =
  (requestId: RequestId) =>
  (request: Waiting | undefined): Result<Waiting, AssignDriverError> =>
    request !== undefined
      ? ok(request)
      : err({ kind: "RequestNotFound", requestId });

const ensureDriverAvailable =
  (driverId: DriverId, isAvailable: boolean) =>
  (waiting: Waiting): Result<Waiting, AssignDriverError> =>
    isAvailable
      ? ok(waiting)
      : err({ kind: "DriverNotAvailable", driverId });

const transitionToEnRoute =
  (driverId: DriverId) =>
  (waiting: Waiting): EnRoute => ({
    kind: "EnRoute",
    requestId: waiting.requestId,
    passengerId: waiting.passengerId,
    driverId,
  });

// --- Use Case (expected-result pipeline with native async persistence) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    const assignment = ok(request)
      .andThen(ensureExists(requestId))
      .andThen(ensureDriverAvailable(driverId, isDriverAvailable))
      .map(transitionToEnRoute(driverId));

    return assignment.match(
      async (enRoute) => {
        await requestStore.save(enRoute);
        return ok(enRoute);
      },
      err,
    );
  };
```

## Recoverable External Failures

Keep a named external error in `Result` only when the workflow can make a recovery decision:

```typescript
type PaymentAuthorizationError = {
  readonly kind: "AuthorizationTemporarilyUnavailable";
  readonly retryAfter: RetryAfter;
};
```

For example, the caller can defer or retry authorization after this error. It is not a wrapper for arbitrary transport failures. Likewise, when the product defines recovery for another named external failure, use a precise `ExternalServiceError` rather than a generic error wrapper.
