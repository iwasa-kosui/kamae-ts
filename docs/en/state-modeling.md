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

An aggregate's state and the events it emits must always be persisted within the same transaction boundary. A naive two-step write — state to one store, events to another — introduces the dual-write problem: if the first write succeeds and the second fails, consistency is broken.

```typescript
// Bad — state and events in separate transactions; a crash between writes breaks consistency
saveRequest(entity).andThen(() => saveEvent(event));
```

The standard solution is the **Outbox Pattern**: the state-table UPDATE and the outbox-table INSERT happen in the same transaction, and a separate process relays outbox rows to the message broker. Express this atomicity in the interface itself. Separate the read side (`RequestResolver`) from the write side to honor the Interface Segregation Principle.

```typescript
type RequestResolver = Readonly<{
  findById: (id: RequestId) => ResultAsync<Waiting | undefined, RepositoryError>;
}>;

type RequestStore = Readonly<{
  save: (
    state: EnRoute,
    events: readonly DriverAssignedEvent[],
  ) => ResultAsync<void, RepositoryError>;
}>;
```

Enclosing everything in a single `save` method structurally prevents callers from reaching a half-written state where the aggregate was updated but no event was emitted.

### Responsibility for event construction

The use-case layer constructs events and passes them to `RequestStore.save` alongside the state. Having the repository generate events internally conflates persistence with business rules and inflates its responsibility.

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

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (requestId: RequestId, driverId: DriverId, now: Date) =>
    requestResolver
      .findById(requestId)
      .andThen(validateWaiting)
      .map(transitionToEnRoute(driverId))
      .andThrough((enRoute) =>
        requestStore.save(enRoute, [buildDriverAssignedEvent(now)(enRoute)]),
      );
```

`now` is injected as a use-case argument. Avoiding `new Date()` inside the use case makes it possible to inject any timestamp in tests.
