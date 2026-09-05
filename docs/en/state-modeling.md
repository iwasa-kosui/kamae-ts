---
title: State Transitions via Pure Functions
parent: English
nav_order: 2
---

# State Modeling — Detailed Guide

## Designing State Transitions with Discriminated Unions

### Design steps

1. Enumerate all states a domain entity can occupy.
2. Identify the properties required in each state.
3. Define a distinct type per state, using `kind` as the discriminant.
4. Combine them into a union type.
5. Define valid transitions as pure functions.
6. Group the functions in a Companion Object.

### From a state-transition diagram to code

```
Waiting → EnRoute → InTrip → Completed
  ↓         ↓        ↓
Cancelled Cancelled Cancelled
```

This diagram translates to types and functions as follows.

```typescript
// 1. Types for each state
type Waiting = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
  passengerId: PassengerId;
  createdAt: Date;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  assignedAt: Date;
}>;

type InTrip = Readonly<{
  kind: "InTrip";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  startedAt: Date;
}>;

type Completed = Readonly<{
  kind: "Completed";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  startedAt: Date;
  completedAt: Date;
}>;

type Cancelled = Readonly<{
  kind: "Cancelled";
  requestId: RequestId;
  passengerId: PassengerId;
  cancelledAt: Date;
  reason: string;
}>;

// 2. Union type
type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;

// 3. Partial union for states that can be cancelled
type CancellableRequest = Waiting | EnRoute | InTrip;

// 4. Transition functions
const TaxiRequest = {
  assignDriver: (waiting: Waiting, driverId: DriverId, now: Date): EnRoute => ({
    kind: "EnRoute",
    requestId: waiting.requestId,
    passengerId: waiting.passengerId,
    driverId,
    assignedAt: now,
  }),

  startTrip: (enRoute: EnRoute, now: Date): InTrip => ({
    kind: "InTrip",
    requestId: enRoute.requestId,
    passengerId: enRoute.passengerId,
    driverId: enRoute.driverId,
    startedAt: now,
  }),

  complete: (inTrip: InTrip, now: Date): Completed => ({
    kind: "Completed",
    requestId: inTrip.requestId,
    passengerId: inTrip.passengerId,
    driverId: inTrip.driverId,
    startedAt: inTrip.startedAt,
    completedAt: now,
  }),

  cancel: (request: CancellableRequest, reason: string, now: Date): Cancelled => ({
    kind: "Cancelled",
    requestId: request.requestId,
    passengerId: request.passengerId,
    cancelledAt: now,
    reason,
  }),

  isCancellable: (request: TaxiRequest) =>
    request.kind === "Waiting" ||
    request.kind === "EnRoute" ||
    request.kind === "InTrip",
} as const;
```

### Notes

**Shared properties:** Even when a property like `requestId` or `passengerId` is common to all states, avoid using `extends` to inherit from a base type. Interface inheritance introduces the declaration-merging problem described earlier. Accept the verbosity of explicitly listing shared properties in each state as the price of type safety.

**Timestamps:** The examples above accept timestamps as arguments rather than calling `new Date()` internally. This makes it possible to inject an arbitrary time in tests, preserving testability.

## Domain Events

Record business occurrences that accompany state transitions as domain events.

```typescript
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
  { driverId: DriverId; passengerId: PassengerId }
>;

type TripCompletedEvent = DomainEvent<
  "TripCompleted",
  { driverId: DriverId; duration: number }
>;
```

### Persist state and events in the same transaction

The aggregate state and the events it emits must be persisted within the same transaction boundary. The naive approach of writing them in two separate steps suffers from the dual-write problem: the moment one succeeds and the other fails, the system is inconsistent.

```typescript
// Bad — state and event are persisted in different transactions; a failure
// between them leaves the aggregate inconsistent.
saveRequest(entity).andThen(() => saveEvent(event));
```

The standard implementation is the **Outbox Pattern**: write the state row and the outbox row atomically in the same DB transaction, and let a separate process relay outbox rows to the broker. Express this atomicity in the interface as well. Read-side concerns are split out as `RequestResolver` (ISP).

```typescript
type RequestResolver = Readonly<{
  findById: (id: RequestId) => Promise<TaxiRequest | undefined>;
}>;

type RequestStore = Readonly<{
  save: (
    state: EnRoute,
    events: readonly DriverAssignedEvent[],
  ) => Promise<void>;
}>;
```

Closing `save` into a single method makes it structurally impossible for callers to produce a half-written aggregate where the state was updated but the event never fired.

### Event generation responsibility

The use case layer generates events and hands them to `RequestStore.save` together with the state. Letting the repository generate events internally bloats its responsibilities by mixing persistence with business rules.

```typescript
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

type RequestNotFound = Readonly<{
  kind: "RequestNotFound";
  requestId: RequestId;
}>;

type InvalidState = Readonly<{
  kind: "InvalidState";
  requestId: RequestId;
}>;

type DriverNotAvailable = Readonly<{
  kind: "DriverNotAvailable";
  driverId: DriverId;
}>;

type AssignDriverDecisionError = InvalidState | DriverNotAvailable;
type AssignDriverError = RequestNotFound | AssignDriverDecisionError;

const assignDriver = (
  request: TaxiRequest,
  driverId: DriverId,
  isDriverAvailable: boolean,
  assignedAt: Date,
): Result<EnRoute, AssignDriverDecisionError> => {
  if (request.kind !== "Waiting") {
    return err({ kind: "InvalidState", requestId: request.requestId });
  }

  if (!isDriverAvailable) {
    return err({ kind: "DriverNotAvailable", driverId });
  }

  return ok(TaxiRequest.assignDriver(request, driverId, assignedAt));
};

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    if (request === undefined) {
      return err({ kind: "RequestNotFound", requestId });
    }

    const assignment = assignDriver(request, driverId, isDriverAvailable, now);

    return assignment.match(
      async (enRoute) => {
        await requestStore.save(enRoute, [buildDriverAssignedEvent(now)(enRoute)]);
        return ok(enRoute);
      },
      err,
    );
  };
```

The use case returns `RequestNotFound` when the resolver finds no request; the pure `assignDriver` decision returns `InvalidState` when the request is no longer `Waiting` and `DriverNotAvailable` when the driver cannot be assigned. Those are expected business outcomes in its `Result`. By contrast, an unexpected rejection from `findById` or `save` propagates to the application error boundary; do not turn it into a generic repository error.

`now` is injected as a parameter; never call `new Date()` inside the use case so tests can pin time deterministically.
