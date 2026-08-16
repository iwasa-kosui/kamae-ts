---
title: Error Handling
parent: English
nav_order: 3
has_children: true
---

# Error Handling — Detailed Guide

## Classify a failure before choosing its representation

Use `Result` for expected workflow outcomes. The decision test is: **does a consumer have a specified domain decision to make for this failure?** If yes, represent the failure as a named member of that use case's error union. If no, let it propagate to the application error boundary.

For library-specific APIs, refer to the relevant guide under [result-libraries/](./result-libraries/).

| Category | Deciding question | Representation | Owner |
| --- | --- | --- | --- |
| Expected domain failure | Is this a business outcome the caller must choose how to handle? | A use-case-specific discriminated-union error in `Result` | The use case and its caller |
| Recoverable external failure | Does the workflow document how to continue after this external failure? | A named error in that use case's `Result` | The use case and its caller |
| Unexpected infrastructure fault | Is the dependency failure outside a documented recovery decision? | A rejected promise or exception that propagates | The application error boundary |
| Contract or invariant violation | Did code reach a state that its types or contracts say is impossible? | An exception that propagates | The application error boundary and the developer who fixes the defect |

## Use-case-specific Result errors

Define expected errors as discriminated unions so callers can handle them exhaustively. Keep each union specific to one use case rather than widening it into a catch-all `AppError` or `RepositoryError`.

```typescript
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

type RequestStore = Readonly<{
  save: (request: EnRoute) => Promise<void>;
}>;
```

An unexpected rejection from `RequestStore.save`, such as a lost database connection, propagates to the application error boundary. Add a named external error to `AssignDriverError` only when the workflow specifies a recovery decision such as retrying, selecting a fallback, or asking the caller to try again.

## Compose expected outcomes

Each operation that can produce an expected domain failure returns a `Result`; composition stops at that expected outcome. The composition API differs by library: neverthrow uses `.andThen`, byethrow uses `Result.andThen`, fp-ts uses `E.chain` or `E.bind`, and option-t uses `andThenForResult`.

```typescript
const ensureFound = <T>(id: RequestId) => (
  value: T | undefined,
): Result<T, { readonly kind: "RequestNotFound"; readonly requestId: RequestId }> =>
  value !== undefined
    ? success(value)
    : failure({ kind: "RequestNotFound", requestId: id });
```

Convert `AssignDriverError` into an HTTP response at the controller boundary by switching on `kind`. The controller owns status-code selection; the use case owns the expected error set. Separately, the application boundary owns logging unexpected faults and returning a generic operational response.

## Contract violations and local control flow

`assertNever` and failed internal assertions represent contract or invariant violations. Let their exceptions reach the application error boundary; do not convert them into catch-all `Result` errors.

A private control-flow sentinel is allowed only when all of these containment conditions hold:

- it is private to a tightly scoped local operation;
- its catch boundary identifies only the sentinel it owns after discriminating `unknown`;
- that boundary rethrows every other caught value; and
- it does not represent validation, an invalid state transition, or another expected domain outcome.

```typescript
const foundDriver = Symbol("foundDriver");

type FoundDriver = {
  readonly kind: typeof foundDriver;
  readonly driver: Driver;
};

const isFoundDriver = (error: unknown): error is FoundDriver =>
  typeof error === "object"
  && error !== null
  && "kind" in error
  && error.kind === foundDriver;

const findFirstAvailable = (drivers: readonly Driver[]): Option<Driver> => {
  try {
    drivers.forEach((driver) => {
      if (driver.isAvailable) {
        throw { kind: foundDriver, driver } satisfies FoundDriver;
      }
    });
    return none;
  } catch (error: unknown) {
    if (isFoundDriver(error)) return some(error.driver);
    throw error;
  }
};
```

Thrown validation errors, invalid state transitions, and other expected domain errors remain prohibited; model them as use-case-specific `Result` errors.
