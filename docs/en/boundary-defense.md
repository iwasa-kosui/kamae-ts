---
title: Boundary Defense
parent: English
nav_order: 4
has_children: true
---

# Boundary Defense — Detailed Guide

## Understanding the Limits of TypeScript Types

TypeScript types are erased at compile time. No type information survives at runtime, so the correctness of data arriving from outside cannot be guaranteed by types alone.

Structural subtyping means an object with extra properties can be assigned to a type with fewer properties. This can cause unintentional data leaks.

```typescript
type LogPayload = { id: string; role: string };
const user = { id: "1", role: "admin", email: "secret@example.com" };

// Passes type checking, but email is included in the log output
console.log(JSON.stringify(user satisfies LogPayload));
```

## Schema-Based Validation

At external boundaries (API requests, DB results, environment variables, file reads), parse data using a validation-library schema.

**Detecting the validation library:** Check `dependencies` / `devDependencies` in the project's `package.json` and follow the guide for the matching library. If none is found, ask the user.

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

The examples below use Zod syntax. For equivalent Valibot and ArkType syntax, see the validation-library guides linked above.

```typescript
import { z } from "zod";

const CreateRequestInput = z.object({
  passengerId: z.string().uuid(),
  pickupLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

type CreateRequestInput = z.infer<typeof CreateRequestInput>;
```

### Using `safeParse`

`parse` throws an exception. For integration with Railway Oriented Programming, use `safeParse` and convert the result to a Result type.

```typescript
// Convert the safeParse result to whichever Result-type library the project uses
const parseInput = (raw: unknown): Result<CreateRequestInput, ValidationError> => {
  const result = CreateRequestInput.safeParse(raw);
  if (result.success) return success(result.data);  // ok(), right(), createOk(), etc.
  return failure({ kind: "ValidationError", issues: result.error.issues });
};
```

### Schema Factory: Auto-Converting Validation → Result

The validation → Result conversion above follows the same pattern for every schema. Instead of writing it by hand each time, define one schema factory matched to the project's Result-type library and auto-generate the `parse` function for each schema.

These factories use the [Standard Schema](https://github.com/standard-schema/standard-schema) interface (`schema['~standard'].validate()`), so they work with **any** Standard Schema-compliant library (Zod, Valibot, ArkType, etc.) without modification.

#### For neverthrow

```typescript
import { ok, err, Result } from "neverthrow";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return err({ kind: "ValidationError", issues: result.issues });
    return ok(result.value);
  };

// Usage — works with Zod, Valibot, ArkType, or any Standard Schema-compliant library
const parseCreateRequestInput = schemaResult(CreateRequestInput);
const parseRequestId = schemaResult(RequestIdSchema);

// parse: (raw: unknown) => Result<CreateRequestInput, ValidationError>
const result = parseCreateRequestInput(rawBody);
```

#### For fp-ts

```typescript
import * as E from "fp-ts/Either";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaEither = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): E.Either<ValidationError, T> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return E.left({ kind: "ValidationError", issues: result.issues });
    return E.right(result.value);
  };
```

#### For option-t

```typescript
import { createOk, createErr, type Result } from "option-t/plain_result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return createErr({ kind: "ValidationError", issues: result.issues });
    return createOk(result.value);
  };
```

#### For byethrow

```typescript
import { Result } from "@praha/byethrow";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result.Result<T, ValidationError> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return Result.fail({ kind: "ValidationError", issues: result.issues });
    return Result.succeed(result.value);
  };
```

#### Guidelines

- Do not hand-write the validation → Result conversion for each schema. Define one factory function and reuse it throughout the project.
- The factory's return type should be unified to the Result-type library the project uses.
- Because the factory uses Standard Schema, the same factory works with any Standard Schema-compliant validation library (Zod, Valibot, ArkType).
- Combine with the Companion Object pattern to expose the schema definition and `parse` function together:

```typescript
// Works with any Standard Schema-compliant validation library
const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema),
} as const;

// At the call site
const id = RequestId.parse(raw); // Result<RequestId, ValidationError>
```

## Banning Type Assertions (`as`)

`as` bypasses type checking. The only permitted forms are `as const` and `as const satisfies Type` — every other `as` is prohibited.

When the value's type is unknown to the compiler (external input, raw data, runtime-shaped objects), the answer is **always to parse it through a validation-library schema**. Asserting a type with `as` does not give you the guarantees the type claims; parsing does.

```typescript
// ❌ as bypasses validation — the type is a lie if data doesn't match
const user = data as User;

// ✅ Schema parse produces a real User
const user = UserSchema.parse(data);
```

For Branded Types, using the validation library's branding feature eliminates the need for `as`. See the [validation-library guides](./validation-libraries/) for Valibot/ArkType Branded Types syntax.

```typescript
// ❌ Manual brand + as cast
type ItemId = string & { readonly __brand: unique symbol };
const ItemIdSchema = z.string().regex(/^item-\d+$/);
const parse = (raw: string): ItemId => ItemIdSchema.parse(raw) as ItemId;

// ✅ z.brand() — no as needed (Zod example)
export const ItemIdBrand = Symbol();
const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();
type ItemId = z.infer<typeof ItemIdSchema>;
const parse = (raw: string): ItemId => ItemIdSchema.parse(raw); // already typed as ItemId
```

### Last-resort exception: `unique symbol` Branded Type factories

Projects that have not yet adopted a validation library may use `as` **only** inside a Branded Type constructor that brands an already-validated value. Treat this as a fallback to be migrated away from as soon as a validation library is introduced — it is not a permanent option.

```typescript
const UserId = {
  of: (value: string): UserId => value as UserId, // permitted only when no validation library is available
};
```

When you encounter a project where this fallback is in use, prefer adding a validation library and rewriting the brand with `z.brand()` / `v.brand()` / `.brand()` over keeping the `as`.

## PII Defense with `Sensitive<T>`

### The Problem

TypeScript types are erased at runtime, so marking a field as PII in the type system does not prevent it from leaking through `JSON.stringify` or `console.log`. With Branded Types, the brand is also lost on variable assignment.

### Solution: Closure-Based Wrapper

Encapsulate the value in a function closure and auto-mask it during serialization.

```typescript
type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
  }),
} as const;
```

### Integration with Validation Libraries

Wrap values in `Sensitive` automatically during parsing. The example below uses Zod. For equivalent Valibot and ArkType syntax, see the [validation-library guides](./validation-libraries/).

```typescript
const sensitiveString = z.string().transform(Sensitive.of);

const PatientSchema = z.object({
  id: z.string().uuid(),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: z.string(), // not PII
});

const patient = PatientSchema.parse(rawData);
console.log(JSON.stringify(patient));
// {"id":"...","name":"[REDACTED]","email":"[REDACTED]","diagnosis":"[REDACTED]","role":"doctor"}
```

### Defense in Depth: Pino Redaction

As a safeguard against missed `Sensitive` wrapping, also configure redaction at the logger level.

```typescript
import pino from "pino";

const logger = pino({
  redact: {
    paths: ["email", "*.email", "password", "*.password", "name", "*.name"],
    censor: "[REDACTED]",
  },
});
```

## Avoid Over-Defending Inside the Domain

Data that has already been validated at an external boundary does not need to be re-validated inside the domain layer. Trust the types.

```typescript
// Bad: redundant checks in the domain layer
const assignDriver = (waiting: Waiting, driverId: DriverId): EnRoute => {
  if (waiting.kind !== "Waiting") throw new Error("Invalid state"); // the type already guarantees this
  if (!driverId) throw new Error("Missing driverId"); // the type already guarantees this
  return { kind: "EnRoute", passengerId: waiting.passengerId, driverId };
};

// Good: trust the types
const assignDriver = (waiting: Waiting, driverId: DriverId): EnRoute => ({
  kind: "EnRoute",
  passengerId: waiting.passengerId,
  driverId,
});
```
