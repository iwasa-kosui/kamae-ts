---
title: Valibot
parent: Boundary Defense
grand_parent: English
nav_order: 2
---

# Valibot

## Core API

```typescript
import * as v from "valibot";
```

| Function / Type | Description |
|-----------------|-------------|
| `v.object({...})` | Object schema |
| `v.string()` | String schema |
| `v.number()` | Number schema |
| `v.pipe(schema, ...actions)` | Chain validations and transforms |
| `v.InferOutput<typeof Schema>` | Extract the TypeScript output type from a schema |
| `v.safeParse(schema, raw)` | Returns `{ success, output, issues }` without throwing |
| `v.parse(schema, raw)` | Returns parsed data or throws `ValiError` |
| `v.brand("Name")` | Attach a nominal brand (used inside `pipe`) |
| `v.transform(fn)` | Transform the parsed value (used inside `pipe`) |
| `v.uuid()` | UUID format validation (used inside `pipe`) |

## Schema Definition

```typescript
const CreateRequestInput = v.object({
  passengerId: v.pipe(v.string(), v.uuid()),
  pickupLocation: v.object({
    lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  }),
});

type CreateRequestInput = v.InferOutput<typeof CreateRequestInput>;
```

## Branded Types

Use `v.brand()` inside `v.pipe()` to define a brand. The brand is automatically attached to the schema's output type — no `as` cast needed.

```typescript
const UserIdSchema = v.pipe(v.string(), v.uuid(), v.brand("UserId"));
type UserId = v.InferOutput<typeof UserIdSchema>;

const ProductIdSchema = v.pipe(v.string(), v.uuid(), v.brand("ProductId"));
type ProductId = v.InferOutput<typeof ProductIdSchema>;

// Output of v.parse() is already branded — no `as` cast needed
```

### Companion Object Pattern

```typescript
const RequestIdSchema = v.pipe(v.string(), v.uuid(), v.brand("RequestId"));
type RequestId = v.InferOutput<typeof RequestIdSchema>;

const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema), // see boundary-defense.md for schemaResult
} as const;
```

## Integration with `Sensitive<T>`

Use `v.transform()` inside `v.pipe()` to automatically wrap PII fields at parse time.

```typescript
const sensitiveString = v.pipe(v.string(), v.transform(Sensitive.of));

const PatientSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: v.string(), // not PII — no wrapping
});
```

## Guidelines

- Use `v.safeParse` rather than `v.parse` for Railway Oriented Programming integration (see [boundary-defense.md](../boundary-defense.md) for the schema factory pattern).
- The schema factory in boundary-defense.md conforms to Standard Schema, so it works with Valibot without modification.
- Valibot is tree-shakeable and significantly lighter than Zod, making it ideal for edge environments such as Cloudflare Workers.
- `v.brand()` eliminates `as` casts for Branded Types.
