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

## Example: State-Transition Pipeline

Following Railway Oriented Programming principles, extract each step into an independent function and compose them in the use case using `pipe` + `Do` / `bind` / `chainFirst`.

For the design of `RequestResolver` / `RequestStore` and how to persist state and domain events in a single transaction, see [state-modeling.md#domain-events](../state-modeling.md#ドメインイベント).

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

// --- Repository Types ---

type RequestResolver = Readonly<{
  findById: (id: RequestId) => TE.TaskEither<RepositoryError, Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => TE.TaskEither<RepositoryError, void>;
}>;

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RepositoryError"; cause: unknown }>;

type RepositoryError = Readonly<{ kind: "RepositoryError"; cause: unknown }>;

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

// --- Use Case (full pipeline composition via Do + bind) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): TE.TaskEither<AssignDriverError, EnRoute> =>
    pipe(
      TE.Do,
      // 1. Fetch request → verify existence
      TE.bind("waiting", () =>
        pipe(
          requestResolver.findById(requestId),
          TE.chainEitherK(ensureExists(requestId)),
        ),
      ),
      // 2. Check driver availability
      TE.bind("driverId", () =>
        TE.fromEither(ensureDriverAvailable(driverId, isDriverAvailable)()),
      ),
      // 3. State transition
      TE.map(transitionToEnRoute),
      // 4. Persist
      TE.chainFirst(requestStore.save),
    );
```
