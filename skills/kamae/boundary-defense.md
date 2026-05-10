# Boundary Defense Detailed Guide

## Understanding the Limits of TypeScript's Type System

TypeScript's types are erased at compile time. Because no type information remains at runtime, the correctness of externally incoming data cannot be guaranteed by types alone.

Structural subtyping allows objects with extra properties to be assigned to types with fewer properties. This can be a source of unintended data leakage.

```typescript
type LogPayload = { id: string; role: string };
const user = { id: "1", role: "admin", email: "secret@example.com" };

// Passes type check, but email is included in the log
console.log(JSON.stringify(user satisfies LogPayload));
```

## Schema-Based Validation

At external boundaries (API requests, DB results, environment variables, file reads), parse with validation library schemas at runtime.

**Validation library detection:** Check `dependencies` / `devDependencies` in the project's `package.json` and follow the guide for the matching library. If none are found, ask the user.

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

The following examples use Zod syntax. See the validation library guides above for Valibot and ArkType equivalents.

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

### Use `safeParse`

`parse` throws an exception. For integration with Railway Oriented Programming, use `safeParse` and convert the result to a Result type.

```typescript
// Convert the safeParse result to the Result type library used in the project
const parseInput = (raw: unknown): Result<CreateRequestInput, ValidationError> => {
  const result = CreateRequestInput.safeParse(raw);
  if (result.success) return success(result.data);  // ok(), right(), createOk(), etc.
  return failure({ kind: "ValidationError", issues: result.error.issues });
};
```

### Schema Factory: Automatic Validation → Result Type Conversion

The validation → Result type conversion follows the same pattern for every schema. Rather than writing it by hand each time, define a single schema factory that matches the Result type library used in the project, and auto-generate `parse` functions for each schema.

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

- Do not hand-write validation → Result conversions for each schema. Define a single factory function and reuse it across the project
- Unify the return type of the factory to the Result type library in use
- The factory uses Standard Schema so it works with any compliant validation library (Zod, Valibot, ArkType)
- Combine with the companion object pattern to expose the schema definition and `parse` function together:

```typescript
// Works with any Standard Schema-compliant validation library
const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema),
} as const;

// Usage
const id = RequestId.parse(raw); // Result<RequestId, ValidationError>
```

## Banning Type Assertions (`as`)

`as` bypasses type checking. Use schema validation for external data; trust type inference for internal data.

```typescript
// Bad
const user = data as User;

// Good
const user = UserSchema.parse(data);
```

For Branded Types, using the validation library's brand feature eliminates the need for `as`. See the [validation library guides](./validation-libraries/) for library-specific syntax (e.g., `z.brand()` for Zod, `v.brand()` for Valibot, `.brand()` for ArkType).

```typescript
// ❌ Manual brand + as cast
type ItemId = string & { readonly __brand: unique symbol };
const ItemIdSchema = z.string().regex(/^item-\d+$/);
const parse = (raw: string): ItemId => ItemIdSchema.parse(raw) as ItemId;

// ✅ z.brand() — no as needed (Zod example)
export const ItemIdBrand = Symbol();
const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();
type ItemId = z.infer<typeof ItemIdSchema>;
const parse = (raw: string): ItemId => ItemIdSchema.parse(raw); // already ItemId type
```

In projects that do not use a validation library, `as` is permitted only inside Branded Type constructor functions.

```typescript
const UserId = {
  of: (value: string): UserId => value as UserId, // permitted only when not using Zod
};
```

## PII Protection with the Sensitive Type

### Problem

TypeScript types are erased at runtime, so marking something as PII in the type system does not prevent leakage via `JSON.stringify` or `console.log`. Even with Branded Types, the brand is lost on variable assignment.

### Solution: Closure-Based Wrapper

Enclose the value in a function closure and automatically mask it during serialization.

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

Automatically wrap in Sensitive at parse time. The following example uses Zod. See the [validation library guides](./validation-libraries/) for Valibot and ArkType equivalents.

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

As a backup for missed Sensitive wrapper applications, also configure redaction at the logger level.

```typescript
import pino from "pino";

const logger = pino({
  redact: {
    paths: ["email", "*.email", "password", "*.password", "name", "*.name"],
    censor: "[REDACTED]",
  },
});
```

## Do Not Over-Defend Inside the Domain

Data that has been validated at the external boundary should not be re-validated inside the domain layer. Trust the types.

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
