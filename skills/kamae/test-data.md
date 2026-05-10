# Test Data Guide

## Type-Safe Test Fixtures with `as const satisfies`

Define dummy test data using `as const satisfies Type`. This preserves discriminant literal types and prevents widening.

```typescript
const waitingRequest = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;

// waitingRequest.kind is the "Waiting" literal type (not string)
```

### Why not just `as const`?

`as const` alone preserves literal types but does not verify that the object matches the expected type. Adding `satisfies Type` ensures type compatibility at compile time while keeping the narrow literal type.

```typescript
// ❌ No type checking — typos go unnoticed
const bad = {
  kind: "Waitng", // typo not caught
  passengerId: "passenger-1" as PassengerId,
} as const;

// ✅ Type-checked + literal types preserved
const good = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;
```
