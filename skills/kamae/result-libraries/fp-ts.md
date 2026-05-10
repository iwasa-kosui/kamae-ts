# fp-ts

## Basic API

```typescript
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
```

| Function/Type | Description |
|---------|------|
| `Either<E, A>` | Synchronous Result type. Error is the first type argument (Left), success is the second (Right) |
| `TaskEither<E, A>` | Asynchronous Result type (`() => Promise<Either<E, A>>`) |
| `E.right(value)` | Creates a success value |
| `E.left(error)` | Creates a failure value |
| `TE.Do` | Creates `TaskEither<never, {}>`. Starting point for incrementally building an object with `bind` |
| `TE.bind(name, fn)` | Adds the result of `fn` to the success value object under the `name` key |
| `TE.chainFirst(fn)` | Executes a side effect and returns the original value on success |
| `TE.chainEitherK(fn)` | Incorporates a function returning synchronous `Either` into a `TaskEither` chain |

## Composition with Pipe

In fp-ts, functions are composed with `pipe` rather than method chaining.

```typescript
pipe(
  E.right(value),
  E.map((a) => transform(a)),           // Transform the success value
  E.mapLeft((e) => transformErr(e)),     // Transform the error value
  E.chain((a) => nextEither(a)),         // Chain to the next Either from a success value (flatMap)
  E.chainFirst((a) => sideEffect(a)),   // Execute a side effect and return the original value on success
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

## Code Example: Recording Domain Events

Following Railway Oriented Programming principles, extract each step into an independent function, and let the use case simply compose them with `pipe` + `Do`/`bind`/`chainFirst`.

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

// --- Domain Event ---

type DomainEvent<TName extends string, TPayload> = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: TName;
  payload: TPayload;
  aggregateId: string;
  aggregateName: string;
}>;

type DriverAssignedEvent = DomainEvent<
  "DriverAssigned",
  Readonly<{ driverId: DriverId; passengerId: PassengerId }>
>;

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

type RequestRepository = {
  findById: (id: RequestId) => TE.TaskEither<RepositoryError, Waiting | undefined>;
  save: (request: EnRoute) => TE.TaskEither<RepositoryError, void>;
};

type EventStore = {
  save: (event: DriverAssignedEvent) => TE.TaskEither<RepositoryError, void>;
};

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

const buildDriverAssignedEvent =
  (now: Date) =>
  (enRoute: EnRoute): DriverAssignedEvent => ({
    eventId: crypto.randomUUID(),
    eventAt: now,
    eventName: "DriverAssigned",
    payload: { driverId: enRoute.driverId, passengerId: enRoute.passengerId },
    aggregateId: enRoute.requestId,
    aggregateName: "TaxiRequest",
  });

const persistEnRoute =
  (requestRepo: RequestRepository) =>
  (enRoute: EnRoute): TE.TaskEither<AssignDriverError, void> =>
    requestRepo.save(enRoute);

const publishEvent =
  (eventStore: EventStore) =>
  (event: DriverAssignedEvent): TE.TaskEither<AssignDriverError, void> =>
    eventStore.save(event);

// --- Use Case (full pipeline composition with Do + bind) ---

const assignDriverUseCase =
  (requestRepo: RequestRepository, eventStore: EventStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
  ): TE.TaskEither<AssignDriverError, EnRoute> =>
    pipe(
      TE.Do,
      // 1. Fetch request → verify existence
      TE.bind("waiting", () =>
        pipe(
          requestRepo.findById(requestId),
          TE.chainEitherK(ensureExists(requestId)),
        ),
      ),
      // 2. Check driver availability
      TE.bind("driverId", () =>
        TE.fromEither(ensureDriverAvailable(driverId, isDriverAvailable)()),
      ),
      // 3. State transition
      TE.map(transitionToEnRoute),
      // 4. Persist (chainFirst preserves enRoute)
      TE.chainFirst(persistEnRoute(requestRepo)),
      // 5. Publish domain event (chainFirst preserves enRoute)
      TE.chainFirst((enRoute) =>
        publishEvent(eventStore)(buildDriverAssignedEvent(now)(enRoute)),
      ),
    );
```
