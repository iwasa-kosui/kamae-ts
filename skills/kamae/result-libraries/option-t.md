# option-t

## Basic API

```typescript
import { createOk, createErr, isOk, isErr, unwrapOk } from "option-t/plain_result";
import { mapForResult } from "option-t/plain_result/map";
import { andThenForResult } from "option-t/plain_result/and_then";
import { andThenAsyncForResult } from "option-t/plain_result/and_then_async";
import { mapErrForResult } from "option-t/plain_result/map_err";
import { orElseForResult } from "option-t/plain_result/or_else";
```

Or using namespace import:

```typescript
import { Result } from "option-t/plain_result/namespace";
// Result.createOk, Result.map, Result.andThen, etc.
```

| Function/Type | Description |
|---------|------|
| `Result<T, E>` | Result type (`Ok<T> \| Err<E>` discriminated union, plain object) |
| `createOk(value)` | Creates a success value (`{ ok: true, val: T, err: null }`) |
| `createErr(error)` | Creates a failure value (`{ ok: false, val: null, err: E }`) |

Main differences from neverthrow:

- Plain objects instead of classes (discriminant is the `ok` field)
- Composition via standalone functions instead of method chaining
- Async operations use `*Async` variant functions (return value is `Promise<Result<T, E>>`)

## Composition with Functions

```typescript
import { mapForResult } from "option-t/plain_result/map";
import { mapErrForResult } from "option-t/plain_result/map_err";
import { andThenForResult } from "option-t/plain_result/and_then";
import { orElseForResult } from "option-t/plain_result/or_else";

const mapped = mapForResult(result, (value) => transform(value));
const mappedErr = mapErrForResult(result, (error) => transformErr(error));
const chained = andThenForResult(result, (value) => nextResult(value));
const recovered = orElseForResult(result, (error) => recover(error));

// Branching uses type guards or the ok field
if (isOk(result)) {
  console.log(result.val);
} else {
  console.log(result.err);
}
```

## Code Example: Recording Domain Events

```typescript
import { createOk, createErr, isOk, isErr, type Result } from "option-t/plain_result";
import { andThenForResult } from "option-t/plain_result/and_then";
import { andThenAsyncForResult } from "option-t/plain_result/and_then_async";
import { mapAsyncForResult } from "option-t/plain_result/map_async";

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
  findById: (id: RequestId) => Promise<Result<Waiting | undefined, RepositoryError>>;
  save: (request: EnRoute) => Promise<Result<void, RepositoryError>>;
};

type EventStore = {
  save: (event: DriverAssignedEvent) => Promise<Result<void, RepositoryError>>;
};

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RepositoryError"; cause: unknown }>;

type RepositoryError = Readonly<{ kind: "RepositoryError"; cause: unknown }>;

// --- Use Case ---

const assignDriverUseCase =
  (requestRepo: RequestRepository, eventStore: EventStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const requestResult = await requestRepo.findById(requestId);

    const waitingResult = andThenForResult(requestResult, (request) =>
      request !== undefined
        ? createOk(request)
        : createErr({ kind: "RequestNotFound" as const, requestId }),
    );

    if (isErr(waitingResult)) return waitingResult;

    const waiting = waitingResult.val;

    if (!isDriverAvailable) {
      return createErr({ kind: "DriverNotAvailable" as const, driverId });
    }

    const enRoute: EnRoute = {
      kind: "EnRoute",
      requestId: waiting.requestId,
      passengerId: waiting.passengerId,
      driverId,
    };

    const event: DriverAssignedEvent = {
      eventId: crypto.randomUUID(),
      eventAt: now,
      eventName: "DriverAssigned",
      payload: { driverId, passengerId: waiting.passengerId },
      aggregateId: waiting.requestId,
      aggregateName: "TaxiRequest",
    };

    const saveResult = await requestRepo.save(enRoute);
    if (isErr(saveResult)) return saveResult;

    const eventResult = await eventStore.save(event);
    if (isErr(eventResult)) return eventResult;

    return createOk(enRoute);
  };
```
