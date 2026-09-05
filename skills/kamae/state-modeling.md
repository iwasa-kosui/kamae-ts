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

  isCancellable: (request: TaxiRequest) =>
    request.kind === "Waiting" ||
    request.kind === "EnRoute" ||
    request.kind === "InTrip",
} as const;
```

### Notes

**Handling shared properties:** Even when properties like `requestId` or `passengerId` are common to all states, avoid inheriting from a base type via `extends`. Interface inheritance introduces declaration merging issues mentioned earlier. Accept the redundancy of explicitly defining properties in each state as a trade-off for type safety.

**Generating timestamps:** The example above accepts timestamps as arguments. This allows injecting arbitrary timestamps in tests, ensuring testability.

## Domain Events

Record business-significant occurrences that accompany state transitions as domain events.

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

### Persist State and Events in the Same Transaction

When a workflow must persist both aggregate state and its emitted events, write them within the same transaction boundary. Writing them in two separate steps suffers from the dual-write problem: the moment one succeeds and the other fails, the system is inconsistent. An event-only workflow does not need an additional state write or a resolver merely to fit this example.

```typescript
// Bad — state and event are persisted in different transactions; a failure
// between them leaves the aggregate inconsistent.
saveRequest(entity).andThen(() => saveEvent(event));
```

For state updates with reliable event delivery, use the **Outbox Pattern**: write the state row and the outbox row atomically in the same DB transaction, and let a separate process relay outbox rows to the broker. Express this atomicity in the contract as well. `RequestResolver` and `RequestStore` each expose one operation; inject them separately into orchestration that needs both. Add other lookups or writes as separate contracts instead of growing these into multi-method interfaces.

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

One `save` method keeps callers from having to coordinate two writes; the adapter must implement the transaction because the signature alone cannot guarantee atomicity. A workflow that only appends events can use a single-method event store such as `TaskEventStore` in [domain-modeling.md](./domain-modeling.md#separate-resolvers-and-stores-by-operation).

### Event Generation Responsibility

Pure decision and event-building functions produce values; the use case orchestrates input resolution and passes the resulting state and events to `RequestStore.save`. Keep business event generation out of the store adapter. Supply time and event IDs as values so neither pure function performs I/O or generates randomness.

```typescript
const buildDriverAssignedEvent =
  (now: Date, eventId: string) =>
  (enRoute: EnRoute): DriverAssignedEvent => ({
    eventId,
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
    eventId: string,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    if (request === undefined) {
      return err({ kind: "RequestNotFound", requestId });
    }

    const assignment = assignDriver(request, driverId, isDriverAvailable, now);

    return assignment.match(
      async (enRoute) => {
        await requestStore.save(enRoute, [buildDriverAssignedEvent(now, eventId)(enRoute)]);
        return ok(enRoute);
      },
      err,
    );
  };
```

The use case returns `RequestNotFound` when the resolver finds no request; the pure `assignDriver` decision returns `InvalidState` when the request is no longer `Waiting` and `DriverNotAvailable` when the driver cannot be assigned. Those are expected business outcomes in its `Result`. By contrast, an unexpected rejection from `findById` or `save` propagates to the application error boundary; do not turn it into a generic repository error.

`now` and `eventId` are supplied by the caller at the I/O boundary, so tests can pin time and identity deterministically. The pure functions receive values, not a clock, ID generator, resolver, or store.
