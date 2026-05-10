---
title: ArkType
parent: Boundary Defense
grand_parent: English
nav_order: 3
---

# ArkType

## Core API

```typescript
import { type } from "arktype";
```

| Function / Type | Description |
|-----------------|-------------|
| `type({...})` | Define an object type |
| `type("string")` | String type |
| `type("number")` | Number type |
| `typeof Schema.infer` | Extract the TypeScript type from a schema |
| `schema(raw)` | Returns validated data or a `type.errors` instance |
| `schema.assert(raw)` | Returns validated data or throws |
| `.brand("Name")` | Attach a nominal brand to the output type |
| `.pipe(fn)` | Transform the validated value (morph) |
| `"string.uuid"` | UUID format validation |
| `"string.email"` | Email format validation |

## Schema Definition

```typescript
const CreateRequestInput = type({
  passengerId: "string.uuid",
  pickupLocation: {
    lat: "number >= -90 & number <= 90",
    lng: "number >= -180 & number <= 180",
  },
});

type CreateRequestInput = typeof CreateRequestInput.infer;
```

## Branded Types

Use `.brand()` to define a brand. The brand is automatically attached to validated output — no `as` cast needed.

```typescript
const UserIdSchema = type("string.uuid").brand("UserId");
type UserId = typeof UserIdSchema.infer;

const ProductIdSchema = type("string.uuid").brand("ProductId");
type ProductId = typeof ProductIdSchema.infer;

// Validated output is already branded — no `as` cast needed
```

### Companion Object Pattern

```typescript
const RequestIdSchema = type("string.uuid").brand("RequestId");
type RequestId = typeof RequestIdSchema.infer;

const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema), // see boundary-defense.md for schemaResult
} as const;
```

## Integration with `Sensitive<T>`

Use `.pipe()` to automatically wrap PII fields at validation time.

```typescript
const sensitiveString = type("string").pipe(Sensitive.of);

const PatientSchema = type({
  id: "string.uuid",
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: "string", // not PII — no wrapping
});
```

## Handling Validation Results

ArkType returns validated data directly on success or an `ArkErrors` instance on failure. Distinguish the two with `instanceof type.errors`.

```typescript
const result = CreateRequestInput(rawData);
if (result instanceof type.errors) {
  // result is ArkErrors — an array of ArkError objects
  console.error(result.summary);
} else {
  // result is CreateRequestInput — validated data
  console.log(result);
}
```

## Guidelines

- ArkType uses a call-based API (`schema(data)`); use `instanceof type.errors` to detect failure instead of `safeParse`.
- The schema factory in [boundary-defense.md](../boundary-defense.md) uses the Standard Schema interface, so it works with ArkType without modification.
- ArkType's type syntax mirrors TypeScript syntax (e.g. `"string | number"`, `"string[]"`), which keeps the learning curve low.
- Optimized for both runtime performance and bundle size, making it well suited for edge environments.
- `.brand()` eliminates `as` casts for Branded Types.
