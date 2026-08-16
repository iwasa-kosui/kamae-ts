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

## Code Example: State Transition Pipeline

For the design of `RequestResolver` / `RequestStore` and how domain events are persisted atomically with state, see [state-modeling.md#domain-events](../state-modeling.md#domain-events).

```typescript
import { createOk, createErr, isErr, type Result } from "option-t/plain_result";

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
  findById: (id: RequestId) => Promise<Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => Promise<void>;
}>;

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

// --- Use Case ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);

    const waitingResult = request !== undefined
      ? createOk(request)
      : createErr({ kind: "RequestNotFound" as const, requestId });

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

    await requestStore.save(enRoute);

    return createOk(enRoute);
  };
```

## Recoverable External Failures

Keep a named external error in `Result` only when the workflow can make a recovery decision:

```typescript
type PaymentAuthorizationError = {
  readonly kind: "AuthorizationTemporarilyUnavailable";
  readonly retryAfter: RetryAfter;
};
```

For example, the caller can defer or retry authorization after this error. It is not a wrapper for arbitrary transport failures.
