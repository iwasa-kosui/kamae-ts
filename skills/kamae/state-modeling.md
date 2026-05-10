# State Modeling Detailed Guide

## Designing State Transitions with Discriminated Unions

### Design Steps

1. Enumerate the possible states of the domain entity
2. Identify the properties needed in each state
3. Define a separate type for each state (using `kind` as the discriminant)
4. Combine them into a Union type
5. Define valid transitions as pure functions
6. Group functions into a Companion Object

### From State Diagram to Code

```
Waiting → EnRoute → InTrip → Completed
  ↓         ↓        ↓
Cancelled Cancelled Cancelled
```

This state diagram translates into types and functions as follows.

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

// 3. Union of cancellable states (partial unions are also useful)
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

  isCancellable: (request: TaxiRequest): request is CancellableRequest =>
    request.kind === "Waiting" ||
    request.kind === "EnRoute" ||
    request.kind === "InTrip",
} as const;
```

### Notes

**Handling shared properties:** Even when properties like `requestId` or `passengerId` are common to all states, avoid inheriting from a base type via `extends`. Interface inheritance introduces declaration merging issues mentioned earlier. Accept the redundancy of explicitly defining properties in each state as a trade-off for type safety.

**Generating timestamps:** The example above accepts timestamps as arguments. This allows injecting arbitrary timestamps in tests, ensuring testability.

## Domain Events

Record business-significant occurrences that accompany state transitions as domain events. Events are stored in a separate store from the repository.

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

### Event Generation Responsibility

The use case layer generates events and passes the entity and events separately to the repository. Having the repository generate events inflates its responsibilities.

```typescript
const assignDriverUseCase = (
  requestId: RequestId,
  driverId: DriverId,
) =>
  findRequest(requestId)
    .andThen(validateWaiting)
    .map((waiting) => {
      const enRoute = TaxiRequest.assignDriver(waiting, driverId);
      const event: DriverAssignedEvent = {
        eventId: crypto.randomUUID(),
        eventAt: new Date(),
        eventName: "DriverAssigned",
        payload: { driverId, passengerId: waiting.passengerId },
        aggregateId: waiting.requestId,
        aggregateName: "TaxiRequest",
      };
      return { entity: enRoute, event };
    })
    .andThen(({ entity, event }) =>
      saveRequest(entity).andThen(() => saveEvent(event))
    );
```
