---
title: Test Data
parent: English
nav_order: 6
---

# Test Data Guide

## Defining Type-Safe Test Fixtures with `as const satisfies`

Define dummy data for tests with `as const satisfies Type`. This preserves discriminant literal types and prevents widening.

```typescript
const waitingRequest = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;

// waitingRequest.kind is the "Waiting" literal type (not string)
```

### Why `as const` Alone Is Not Enough

`as const` preserves literal types, but does not verify that the object is compatible with the expected type. Adding `satisfies Type` guarantees type compatibility at compile time while still keeping the literal types.

```typescript
// ❌ No type checking — typos go undetected
const bad = {
  kind: "Waitng", // typo is silently ignored
  passengerId: "passenger-1" as PassengerId,
} as const;

// ✅ Type checked + literal types preserved
const good = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;
```
