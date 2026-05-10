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

## Code Example: Recording Domain Events

Following Railway Oriented Programming principles, extract each step into an independent function, and let the use case simply compose them with method chaining. Use `andThrough` to run side effects while preserving the original value.

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow";

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
  findById: (id: RequestId) => ResultAsync<Waiting | undefined, RepositoryError>;
  save: (request: EnRoute) => ResultAsync<void, RepositoryError>;
};

type EventStore = {
  save: (event: DriverAssignedEvent) => ResultAsync<void, RepositoryError>;
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
  (enRoute: EnRoute): ResultAsync<void, AssignDriverError> =>
    requestRepo.save(enRoute);

const publishEvent =
  (eventStore: EventStore) =>
  (event: DriverAssignedEvent): ResultAsync<void, AssignDriverError> =>
    eventStore.save(event);

// --- Use Case (pipeline composition with andThrough) ---

const assignDriverUseCase =
  (requestRepo: RequestRepository, eventStore: EventStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
  ): ResultAsync<EnRoute, AssignDriverError> =>
    requestRepo
      .findById(requestId)
      .andThen(ensureExists(requestId))
      .andThen(ensureDriverAvailable(driverId, isDriverAvailable))
      .map(transitionToEnRoute(driverId))
      .andThrough(persistEnRoute(requestRepo))
      .andThrough((enRoute) =>
        publishEvent(eventStore)(buildDriverAssignedEvent(now)(enRoute)),
      );
```
