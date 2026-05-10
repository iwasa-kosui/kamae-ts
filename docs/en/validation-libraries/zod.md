---
title: Zod
parent: Boundary Defense
grand_parent: English
nav_order: 1
---

# Zod

## Core API

```typescript
import { z } from "zod";
```

| Function / Type | Description |
|-----------------|-------------|
| `z.object({...})` | Object schema |
| `z.string()` | String schema |
| `z.number()` | Number schema |
| `z.infer<typeof Schema>` | Extract the TypeScript type from a schema |
| `schema.safeParse(raw)` | Returns `{ success, data, error }` without throwing |
| `schema.parse(raw)` | Returns parsed data or throws `ZodError` |
| `z.brand<typeof Brand>()` | Attach a nominal brand to the output type (uses `unique symbol`) |
| `.transform(fn)` | Transform the parsed value |

## Schema Definition

```typescript
const CreateRequestInput = z.object({
  passengerId: z.string().uuid(),
  pickupLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

type CreateRequestInput = z.infer<typeof CreateRequestInput>;
```

## Branded Types

Use `z.brand()` to define a brand. The brand is automatically attached to the schema's output type, eliminating any need for `as` casts.

```typescript
export const UserIdBrand = Symbol();
const UserIdSchema = z.string().uuid().brand<typeof UserIdBrand>();
type UserId = z.infer<typeof UserIdSchema>;

export const ProductIdBrand = Symbol();
const ProductIdSchema = z.string().uuid().brand<typeof ProductIdBrand>();
type ProductId = z.infer<typeof ProductIdSchema>;

// safeParse().data is already branded — no `as` cast needed
```

### Companion Object Pattern

```typescript
export const RequestIdBrand = Symbol();
const RequestIdSchema = z.string().uuid().brand<typeof RequestIdBrand>();
type RequestId = z.infer<typeof RequestIdSchema>;

const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema), // see boundary-defense.md for schemaResult
} as const;
```

## Integration with `Sensitive<T>`

Use `.transform()` to automatically wrap PII fields at parse time.

```typescript
const sensitiveString = z.string().transform(Sensitive.of);

const PatientSchema = z.object({
  id: z.string().uuid(),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: z.string(), // not PII — no wrapping
});
```

## Guidelines

- Use `safeParse` rather than `parse` for Railway Oriented Programming integration (see [boundary-defense.md](../boundary-defense.md) for the schema factory pattern).
- The schema factory in boundary-defense.md conforms to Standard Schema, so it works with Zod without modification.
- `z.brand()` eliminates `as` casts for Branded Types.
- Use `unique symbol` (via `Symbol()`) as the brand key rather than a string literal — string literals break encapsulation and pollute autocomplete.
