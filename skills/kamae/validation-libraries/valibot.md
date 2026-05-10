# Valibot

## Basic API

```typescript
import * as v from "valibot";
```

| Function/Type | Description |
|---------|------|
| `v.object({...})` | Object schema |
| `v.string()` | String schema |
| `v.number()` | Number schema |
| `v.pipe(schema, ...actions)` | Chain validations and transformations |
| `v.InferOutput<typeof Schema>` | Extract TypeScript output type from schema |
| `v.safeParse(schema, raw)` | Returns `{ success, output, issues }` without throwing |
| `v.parse(schema, raw)` | Returns parsed data or throws `ValiError` |
| `v.brand("Name")` | Adds a nominal brand (used inside `pipe`) |
| `v.transform(fn)` | Transforms the parsed value (used inside `pipe`) |
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

Define brands with `v.brand()` inside `v.pipe()`. The schema output type becomes automatically branded.

```typescript
const UserIdSchema = v.pipe(v.string(), v.uuid(), v.brand("UserId"));
type UserId = v.InferOutput<typeof UserIdSchema>;

const ProductIdSchema = v.pipe(v.string(), v.uuid(), v.brand("ProductId"));
type ProductId = v.InferOutput<typeof ProductIdSchema>;

// v.parse() output is already branded — no `as` cast needed
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

## Sensitive Type Integration

Auto-wrap PII fields at parse time using `v.transform()` inside `v.pipe()`.

```typescript
const sensitiveString = v.pipe(v.string(), v.transform(Sensitive.of));

const PatientSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: v.string(), // not PII
});
```

## Guidelines

- Use `v.safeParse` over `v.parse` for Railway Oriented Programming integration (see [boundary-defense.md](../boundary-defense.md) for schema factory patterns)
- The same schema factory works across all Standard Schema-compliant libraries — the schema factories in boundary-defense.md work with Valibot without modification
- Valibot is tree-shakeable and significantly smaller than Zod, making it ideal for edge environments (Cloudflare Workers, etc.)
- `v.brand()` eliminates the need for `as` casts on Branded Types
