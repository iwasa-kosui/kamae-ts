---
title: byethrow
parent: Error Handling
grand_parent: English
nav_order: 2
---

# @praha/byethrow

## Core API

```typescript
import { Result } from "@praha/byethrow";
```

| Function / Type | Description |
|-----------------|-------------|
| `Result.Result<T, E>` | Result type (`Success<T> \| Failure<E>` discriminated union, plain object) |
| `Result.ResultAsync<T, E>` | Type alias for `Promise<Result<T, E>>` |
| `Result.succeed(value)` | Constructs a success value (`{ type: "Success", value }`) |
| `Result.fail(error)` | Constructs a failure value (`{ type: "Failure", error }`) |
| `Result.do()` | Produces `Success<{}>`. Starting point for incrementally building an object with `bind` |
| `Result.bind(name, fn)` | Adds the result of `fn` to the success object under `name` (`andThen` + merge) |
| `Result.andThrough(fn)` | Runs a side effect; on success, returns the original value unchanged |
| `Result.orThrough(fn)` | Runs a side effect on the error path; on failure, returns the original error unchanged |

Key differences from neverthrow:

- Plain objects instead of classes (discriminant is the `type` field)
- Composition via `Result.pipe` + curried functions instead of method chaining
- `andThrough` / `orThrough` for side effects that preserve the current value

## Composition with pipe

```typescript
Result.pipe(
  result,
  Result.map((value) => transform(value)),         // Transform the success value
  Result.mapError((error) => transformErr(error)),  // Transform the error value
  Result.andThen((value) => nextResult(value)),     // Chain to the next Result (flatMap)
  Result.andThrough((value) => sideEffect(value)),  // Run a side effect; preserve the original value on success
  Result.orElse((error) => recover(error)),         // Recover from an error
);

// Async: passing a function that returns Promise<Result> to andThen/andThrough
// automatically promotes the entire pipe to a Promise (ResultMaybeAsync)
Result.pipe(
  result,
  Result.andThen((value) => fetchSomething(value)), // Returning ResultAsync is fine
  Result.andThrough((value) => saveToDb(value)),    // Side effects also support async
);

// do + bind: incrementally build an object
Result.pipe(
  Result.do(),                                       // Start from Success<{}>
  Result.bind("user", () => findUser(userId)),       // { user: User }
  Result.bind("order", ({ user }) => findOrder(user)), // { user: User, order: Order }
  Result.andThrough(({ order }) => validate(order)), // Validation (value is preserved)
  Result.map(({ user, order }) => buildResponse(user, order)),
);

// Branch with a type guard
if (Result.isSuccess(result)) {
  console.log(result.value);
} else {
  console.log(result.error);
}
```

## Example: State-Transition Pipeline

Following Railway Oriented Programming principles, extract each expected business decision into an independent function, and compose them with `Result.pipe`. Persist only after the decision succeeds so a rejected promise remains an unexpected failure.

For the design of `RequestResolver` / `RequestStore` and how to persist state and domain events in a single transaction, see [state-modeling.md#domain-events](../state-modeling.md#domain-events).

```typescript
import { Result } from "@praha/byethrow";

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
  (request: Waiting | undefined): Result.Result<Waiting, AssignDriverError> =>
    request !== undefined
      ? Result.succeed(request)
      : Result.fail({ kind: "RequestNotFound", requestId });

const ensureDriverAvailable =
  (driverId: DriverId, isAvailable: boolean) =>
  (): Result.Result<DriverId, AssignDriverError> =>
    isAvailable
      ? Result.succeed(driverId)
      : Result.fail({ kind: "DriverNotAvailable", driverId });

const transitionToEnRoute = (ctx: {
  waiting: Waiting;
  driverId: DriverId;
}): EnRoute => ({
  kind: "EnRoute",
  requestId: ctx.waiting.requestId,
  passengerId: ctx.waiting.passengerId,
  driverId: ctx.driverId,
});

// --- Use Case (full pipeline composition via do + bind) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): Promise<Result.Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    const assignment = Result.pipe(
      Result.do(),
      // 1. Fetch request → verify existence
      Result.bind("waiting", () =>
        ensureExists(requestId)(request),
      ),
      // 2. Check driver availability
      Result.bind("driverId", () =>
        ensureDriverAvailable(driverId, isDriverAvailable)(),
      ),
      // 3. State transition
      Result.map(transitionToEnRoute),
    );

    if (!Result.isSuccess(assignment)) return assignment;

    await requestStore.save(assignment.value);
    return assignment;
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

For example, the caller can defer or retry authorization after this error. It is not a wrapper for arbitrary transport failures.
