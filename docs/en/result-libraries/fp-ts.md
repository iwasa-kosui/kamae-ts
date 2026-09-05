---
title: fp-ts
parent: Error Handling
grand_parent: English
nav_order: 3
---

# fp-ts

## Core API

```typescript
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
```

| Function / Type | Description |
|-----------------|-------------|
| `Either<E, A>` | Synchronous Result type. Error is the first type parameter (Left); success is the second (Right) |
| `TaskEither<E, A>` | Asynchronous Result type (`() => Promise<Either<E, A>>`) |
| `E.right(value)` | Constructs a success value |
| `E.left(error)` | Constructs a failure value |
| `TE.Do` | Produces `TaskEither<never, {}>`. Starting point for incrementally building an object with `bind` |
| `TE.bind(name, fn)` | Adds the result of `fn` to the success object under `name` |
| `TE.chainFirst(fn)` | Runs a side effect; on success, returns the original value unchanged |
| `TE.chainEitherK(fn)` | Lifts a synchronous `Either`-returning function into a `TaskEither` chain |

## Composition with pipe

In fp-ts, functions are composed with `pipe` rather than method chaining.

```typescript
pipe(
  E.right(value),
  E.map((a) => transform(a)),           // Transform the success value
  E.mapLeft((e) => transformErr(e)),     // Transform the error value
  E.chain((a) => nextEither(a)),         // Chain to the next Either (flatMap)
  E.chainFirst((a) => sideEffect(a)),   // Run a side effect; preserve the original value on success
  E.fold(
    (error) => handleErr(error),
    (value) => handleOk(value),
  ),
);

// Do + bind: incrementally build an object
pipe(
  TE.Do,                                              // Start from TaskEither<never, {}>
  TE.bind("user", () => findUser(userId)),            // { user: User }
  TE.bind("order", ({ user }) => findOrder(user)),    // { user: User, order: Order }
  TE.chainFirst(({ order }) => validate(order)),      // Validation (value is preserved)
  TE.map(({ user, order }) => buildResponse(user, order)),
);
```

## TaskEither Contract and Error Boundary

`TaskEither<E, A>` is structurally the same type as `Task<Either<E, A>>`; spelling out the type does not change error handling. `Task` represents an asynchronous computation that never fails, and `TaskEither` represents failure as `Left` without rejecting its promise. See the [Task contract](https://gcanti.github.io/fp-ts/modules/Task.ts.html#task-overview) and [TaskEither definition](https://gcanti.github.io/fp-ts/modules/TaskEither.ts.html#taskeither-overview).

Adapt I/O that can reject with `TE.tryCatch`. Do not pass it to `TE.fromTask` or rethrow inside a `tryCatch` error mapper. The example distinguishes business errors in `ExpectedFailure` from operational faults in `UnexpectedFault`. After the pipeline runs, `execute` returns the business `Either` or rethrows the original fault cause. This application boundary returns a native `Promise` that may reject; do not declare it as `Task` or `TaskEither`.

## Example: State-Transition Pipeline

Compose lookup, business decisions, and persistence with `TaskEither` and `pipe`. Use `bindW`, `chainEitherKW`, and `chainFirstW` when combining different error types. Keep unexpected faults outside the domain error union; a separate `ExecutionFailure` carries them to the application boundary.

For the design of `RequestResolver` / `RequestStore` and how to persist state and domain events in a single transaction, see [state-modeling.md#domain-events](../state-modeling.md#domain-events).

```typescript
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";

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

// --- Domain Errors ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

// --- Execution Failures (outside the domain error union) ---

type ExpectedFailure<D> = Readonly<{ kind: "ExpectedFailure"; error: D }>;
type UnexpectedFault = Readonly<{ kind: "UnexpectedFault"; cause: unknown }>;
type ExecutionFailure<D> = ExpectedFailure<D> | UnexpectedFault;

const expectedFailure = <D>(error: D): ExpectedFailure<D> =>
  ({ kind: "ExpectedFailure", error });

const unexpectedFault = (cause: unknown): UnexpectedFault =>
  ({ kind: "UnexpectedFault", cause });

// --- Repository Ports and I/O Adapters ---

type RequestResolver = Readonly<{
  findById: (id: RequestId) => TE.TaskEither<UnexpectedFault, Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => TE.TaskEither<UnexpectedFault, void>;
}>;

const createRequestResolver = (
  findById: (id: RequestId) => Promise<Waiting | undefined>,
): RequestResolver => ({
  findById: (id) => TE.tryCatch(() => findById(id), unexpectedFault),
});

const createRequestStore = (
  save: (state: EnRoute) => Promise<void>,
): RequestStore => ({
  save: (state) => TE.tryCatch(() => save(state), unexpectedFault),
});

// --- Domain Functions ---

const ensureExists =
  (requestId: RequestId) =>
  (request: Waiting | undefined): E.Either<AssignDriverError, Waiting> =>
    request !== undefined
      ? E.right(request)
      : E.left({ kind: "RequestNotFound", requestId });

const ensureDriverAvailable =
  (driverId: DriverId, isAvailable: boolean) =>
  (): E.Either<AssignDriverError, DriverId> =>
    isAvailable
      ? E.right(driverId)
      : E.left({ kind: "DriverNotAvailable", driverId });

const transitionToEnRoute = (ctx: {
  waiting: Waiting;
  driverId: DriverId;
}): EnRoute => ({
  kind: "EnRoute",
  requestId: ctx.waiting.requestId,
  passengerId: ctx.waiting.passengerId,
  driverId: ctx.driverId,
});

// --- Use Case (full TaskEither pipeline) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): TE.TaskEither<ExecutionFailure<AssignDriverError>, EnRoute> =>
    pipe(
      TE.Do,
      // 1. Fetch request → verify existence
      TE.bindW("waiting", () =>
        pipe(
          requestResolver.findById(requestId),
          TE.chainEitherKW((request) =>
            pipe(ensureExists(requestId)(request), E.mapLeft(expectedFailure)),
          ),
        ),
      ),
      // 2. Check driver availability
      TE.bindW("driverId", () =>
        pipe(
          ensureDriverAvailable(driverId, isDriverAvailable)(),
          E.mapLeft(expectedFailure),
          TE.fromEither,
        ),
      ),
      // 3. State transition
      TE.map(transitionToEnRoute),
      // 4. Persist, preserving the assigned state
      TE.chainFirstW(requestStore.save),
    );

// --- Application Execution Boundary ---

const execute = async <D, A>(
  task: TE.TaskEither<ExecutionFailure<D>, A>,
): Promise<E.Either<D, A>> => {
  const result = await task();
  return pipe(
    result,
    E.match(
      (failure): E.Either<D, A> => {
        switch (failure.kind) {
          case "ExpectedFailure":
            return E.left(failure.error);
          case "UnexpectedFault":
            throw failure.cause;
        }
      },
      (value) => E.right(value),
    ),
  );
};
```

At the application boundary, call `await execute(assignDriverUseCase(resolver, store)(requestId, driverId, true))`. The returned business `Either` still has only `AssignDriverError` on its error side. Do not expose `UnexpectedFault` as a business outcome; the outer error handler owns logging and the generic operational response.

## Recoverable External Failures

Add a named external error to the domain `Either` error union only when the workflow can make a recovery decision:

```typescript
type PaymentAuthorizationError = {
  readonly kind: "AuthorizationTemporarilyUnavailable";
  readonly retryAfter: RetryAfter;
};
```

For example, the caller can defer or retry authorization after this error. It is not a wrapper for arbitrary transport failures.
