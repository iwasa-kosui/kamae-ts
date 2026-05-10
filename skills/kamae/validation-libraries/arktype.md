# ArkType

## Basic API

```typescript
import { type } from "arktype";
```

| Function/Type | Description |
|---------|------|
| `type({...})` | Object type definition |
| `type("string")` | String type |
| `type("number")` | Number type |
| `typeof Schema.infer` | Extract TypeScript type from type definition |
| `schema(raw)` | Returns validated data or `type.errors` |
| `schema.assert(raw)` | Returns validated data or throws |
| `.brand("Name")` | Adds a nominal brand to the output type |
| `.pipe(fn)` | Transforms the validated value (morph) |
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

Define brands with `.brand()`. The validated output is automatically branded.

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

## Sensitive Type Integration

Auto-wrap PII fields at validation time using `.pipe()`.

```typescript
const sensitiveString = type("string").pipe(Sensitive.of);

const PatientSchema = type({
  id: "string.uuid",
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: "string", // not PII
});
```

## Validation Result Handling

ArkType returns validated data directly, or an `ArkErrors` instance on failure. Use `instanceof type.errors` to discriminate.

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

- ArkType uses a call-based API (`schema(data)`) instead of `safeParse` — check `instanceof type.errors` for failure
- The schema factories in [boundary-defense.md](../boundary-defense.md) use the Standard Schema interface and work with ArkType without modification
- ArkType's type syntax mirrors TypeScript syntax (e.g., `"string | number"`, `"string[]"`) for a minimal learning curve
- ArkType is highly optimized for runtime performance and small bundle size, making it suitable for edge environments
- `.brand()` eliminates the need for `as` casts on Branded Types
