# @praha/byethrow

## Basic API

```typescript
import { Result } from "@praha/byethrow";
```

| Function/Type | Description |
|---------|------|
| `Result.Result<T, E>` | Result type (`Success<T> \| Failure<E>` discriminated union, plain object) |
| `Result.ResultAsync<T, E>` | Type alias for `Promise<Result<T, E>>` |
| `Result.succeed(value)` | Creates a success value (`{ type: "Success", value }`) |
| `Result.fail(error)` | Creates a failure value (`{ type: "Failure", error }`) |
| `Result.do()` | Creates `Success<{}>`. Starting point for incrementally building an object with `bind` |
| `Result.bind(name, fn)` | Adds the result of `fn` to the success value object under the `name` key (`andThen` + merge) |
| `Result.andThrough(fn)` | Executes a side effect and returns the original value on success |
| `Result.orThrough(fn)` | Executes a side effect on the error side and returns the original error on failure |

Main differences from neverthrow:

- Plain objects instead of classes (discriminant is the `type` field)
- Composition via `Result.pipe` + curried functions instead of method chaining
- `andThrough` / `orThrough` allow side effects while preserving the original value

## Composition with Pipe

```typescript
Result.pipe(
  result,
  Result.map((value) => transform(value)),         // Transform the success value
  Result.mapError((error) => transformErr(error)),  // Transform the error value
  Result.andThen((value) => nextResult(value)),     // Chain to the next Result from a success value (flatMap)
  Result.andThrough((value) => sideEffect(value)),  // Execute a side effect and return the original value on success
  Result.orElse((error) => recover(error)),         // Recover from an error
);

// Async: passing a function that returns Promise<Result> to andThen/andThrough
// automatically promotes the entire pipe to a Promise (ResultMaybeAsync)
Result.pipe(
  result,
  Result.andThen((value) => fetchSomething(value)), // ResultAsync is also fine
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

// Branching uses type guards
if (Result.isSuccess(result)) {
  console.log(result.value);
} else {
  console.log(result.error);
}
```

## Code Example: Recording Domain Events

Following Railway Oriented Programming principles, extract each step into an independent function, and let the use case simply compose them with `Result.pipe`.

```typescript
import { Result } from "@praha/byethrow";

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
  findById: (id: RequestId) => Result.ResultAsync<Waiting | undefined, RepositoryError>;
  save: (request: EnRoute) => Result.ResultAsync<void, RepositoryError>;
};

type EventStore = {
  save: (event: DriverAssignedEvent) => Result.ResultAsync<void, RepositoryError>;
};

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RepositoryError"; cause: unknown }>;

type RepositoryError = Readonly<{ kind: "RepositoryError"; cause: unknown }>;

// --- Domain Functions ---

const findWaitingRequest =
  (requestRepo: RequestRepository) =>
  (requestId: RequestId): Result.ResultAsync<Waiting | undefined, AssignDriverError> =>
    requestRepo.findById(requestId);

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
  (enRoute: EnRoute): Result.ResultAsync<void, AssignDriverError> =>
    requestRepo.save(enRoute);

const publishEvent =
  (eventStore: EventStore) =>
  (event: DriverAssignedEvent): Result.ResultAsync<void, AssignDriverError> =>
    eventStore.save(event);

// --- Use Case (full pipeline composition with do + bind) ---

const assignDriverUseCase =
  (requestRepo: RequestRepository, eventStore: EventStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
  ): Result.ResultAsync<EnRoute, AssignDriverError> =>
    Result.pipe(
      Result.do(),
      // 1. Fetch request → verify existence
      Result.bind("waiting", () =>
        Result.pipe(
          findWaitingRequest(requestRepo)(requestId),
          Result.andThen(ensureExists(requestId)),
        ),
      ),
      // 2. Check driver availability
      Result.bind("driverId", () =>
        ensureDriverAvailable(driverId, isDriverAvailable)(),
      ),
      // 3. State transition
      Result.map(transitionToEnRoute),
      // 4. Persist (andThrough preserves enRoute)
      Result.andThrough(persistEnRoute(requestRepo)),
      // 5. Publish domain event (andThrough preserves enRoute)
      Result.andThrough((enRoute) =>
        publishEvent(eventStore)(buildDriverAssignedEvent(now)(enRoute)),
      ),
    );
```
