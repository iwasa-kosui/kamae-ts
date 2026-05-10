---
name: functional-ts
description: Use when writing server-side TypeScript code involving domain models, use cases, repositories, state transitions, or business logic. Guides functional domain modeling with discriminated unions, pure functions, and Result types.
license: MIT
---

# Functional Domain Modeling in TypeScript

Principles for writing domain models in server-side TypeScript. Instead of class-based OOP, this approach maximizes the TypeScript type system through a functional style.

## 1. Type-Driven Domain Modeling

### Represent State with Discriminated Unions

Define domain entity states using Discriminated Unions instead of classes. Define each state as its own type and make state-specific properties required.

```typescript
// Good: Each state is an independent type. State-specific properties are required
type Waiting = Readonly<{
  kind: "Waiting";
  passengerId: PassengerId;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  passengerId: PassengerId;
  driverId: DriverId;
}>;

type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;
```

```typescript
// Bad: Cramming all states into one type with optional properties
type TaxiRequest = {
  state: string;
  passengerId: string;
  driverId?: string;    // unclear which state this exists in
  startTime?: Date;     // null checks required everywhere
  endTime?: Date;
};
```

**Rationale:** Optional properties cannot guarantee at compile time which properties exist in which state. With Discriminated Unions, once you narrow on `kind` in a switch statement, you can safely access state-specific properties.

### Use `kind` as the unified discriminant

Use `kind` as the discriminant property name throughout the entire project. Mixing `type`, `status`, `state`, etc. undermines codebase consistency.

### Companion Object Pattern

Group a type definition and its related functions under an object of the same name. Branded Type validation schemas should be exposed as a `schema` property on the companion object, not as standalone exports.

```typescript
// ❌ Standalone schema export — leaks implementation details
export const ItemIdBrand = Symbol();
export const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();

// ✅ Companion object owns the schema
const ItemIdBrand = Symbol();
const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();
export type ItemId = z.infer<typeof ItemIdSchema>;

export const ItemId = {
  schema: ItemIdSchema,
  parse: (raw: string) => ItemIdSchema.safeParse(raw),
} as const;
```

```typescript
type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;

const TaxiRequest = {
  assignDriver: (waiting: Waiting, driverId: DriverId): EnRoute => ({
    kind: "EnRoute",
    passengerId: waiting.passengerId,
    driverId,
  }),

  startTrip: (enRoute: EnRoute, startTime: Date): InTrip => ({
    kind: "InTrip",
    passengerId: enRoute.passengerId,
    driverId: enRoute.driverId,
    startTime,
  }),

  isActive: (request: TaxiRequest): request is Waiting | EnRoute | InTrip =>
    request.kind !== "Completed" && request.kind !== "Cancelled",
} as const;
```

### Use `type` (not `interface`)

Define domain types with `type`. The declaration merging of `interface` poses a risk: declaring an interface with the same name in another file silently changes the type's shape.

```typescript
// Good
type User = Readonly<{
  id: UserId;
  name: string;
}>;

// Bad: if another file declares `interface User { hashedPassword?: string }`,
// the type changes without you noticing
interface User {
  id: string;
  name: string;
}
```

### Use function property notation (not method notation)

Write functions inside type definitions using function property notation, not method notation. Method notation makes parameter types bivariant, breaking type safety.

```typescript
// Good: function property notation — parameters are contravariant
type TaskRepository = {
  save: (task: Task) => Promise<void>;
  findById: (id: TaskId) => Promise<Task | undefined>;
};

// Bad: method notation — parameters become bivariant,
// allowing a narrower implementation like save(task: DoingTask) to pass type checks
type TaskRepository = {
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | undefined>;
};
```

### Distinguish meaning with Branded Types

Due to structural subtyping, two `string` values are compatible. Apply Branded Types to IDs and values with different semantic meanings.

**Validation library detection:** Check `dependencies` / `devDependencies` in the project's `package.json` and follow the guide for the matching library. If none are found, ask the user.

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

When using a validation library, define brands with its brand feature. The schema output type becomes automatically branded, eliminating the need for `as` casts. The following example uses Zod:

```typescript
import { z } from "zod";

export const UserIdBrand = Symbol();
const UserIdSchema = z.string().uuid().brand<typeof UserIdBrand>();
type UserId = z.infer<typeof UserIdSchema>;

export const ProductIdBrand = Symbol();
const ProductIdSchema = z.string().uuid().brand<typeof ProductIdBrand>();
type ProductId = z.infer<typeof ProductIdSchema>;

// safeParse().data is already branded — no `as` cast needed
```

For projects not using a validation library, use the `unique symbol` pattern.

```typescript
export const UserIdBrand = Symbol();
type UserId = string & { readonly [typeof UserIdBrand]: never };

export const ProductIdBrand = Symbol();
type ProductId = string & { readonly [typeof ProductIdBrand]: never };
```

### Ensure immutability with `Readonly<>`

Define domain objects with `Readonly<>` to prevent property reassignment. Express state changes by creating new objects.

### File structure: one concept per file

Place each domain concept (type + companion object) in its own dedicated file. Catch-all files like `types.ts` or `models.ts` are prohibited — they separate types from behavior and cause circular dependencies.

```
// ❌ Types aggregated in types.ts, companions in separate files
// types.ts — ItemId, ItemType, Status, Priority, Item, Config, ...
// item-id.ts — ItemId companion object (imports type from types.ts)

// ✅ Split files per concept
// item-id.ts — type ItemId + const ItemId (companion)
// item-type.ts — type ItemType + const ItemType (companion)
// status.ts — type Status + const Status (companion)
```

Barrel files (`index.ts`) are for re-exports only; do not define types or functions directly in them.

## 2. State Transitions via Functions

Express state transitions with pure functions. The argument type constrains valid source states, and the return type makes the target state explicit.

```typescript
// assignDriver can only be called from the Waiting state
const assignDriver = (waiting: Waiting, driverId: DriverId): EnRoute => ({
  kind: "EnRoute",
  passengerId: waiting.passengerId,
  driverId,
});
```

Invalid transitions (e.g., `assignDriver(completed, driverId)`) become compile errors. No runtime checks needed.

### Exhaustiveness Checking

Use `assertNever` in switch statements to guarantee at compile time that all cases are handled. When a new state is added, unhandled locations are caught as compile errors.

```typescript
const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
};

const describe = (request: TaxiRequest): string => {
  switch (request.kind) {
    case "Waiting": return "Waiting for driver";
    case "EnRoute": return `Driver ${request.driverId} en route`;
    case "InTrip": return "In trip";
    case "Completed": return "Completed";
    case "Cancelled": return "Cancelled";
    default: return assertNever(request);
  }
};
```

## 3. Error Handling — Railway Oriented Programming

Do not throw exceptions; treat errors as values using the Result type.

**Library detection:** Check `dependencies` / `devDependencies` in the project's `package.json` and follow the guide for the matching library. If none are found, ask the user.

- `neverthrow` → [result-libraries/neverthrow.md](./result-libraries/neverthrow.md)
- `byethrow` → [result-libraries/byethrow.md](./result-libraries/byethrow.md)
- `fp-ts` → [result-libraries/fp-ts.md](./result-libraries/fp-ts.md)
- `option-t` → [result-libraries/option-t.md](./result-libraries/option-t.md)

Define error types as Discriminated Unions so callers can handle them exhaustively.

```typescript
type AssignError =
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RequestAlreadyAssigned" }>;
```

Express success and failure with types and compose processing with chains. See the library-specific guides above for each library's API.

Details: [error-handling.md](./error-handling.md)

## 4. Boundary Defense

Validate external inputs (API requests, DB results, file reads) with validation library schemas at runtime. Trust types inside the domain layer and avoid excessive defensive validation. For validation library-specific syntax, see the [validation library guides](./validation-libraries/) linked in the Branded Types section above.

```typescript
import { z } from "zod";

const CreateRequestSchema = z.object({
  passengerId: z.string().uuid().transform(PassengerId.of),
});

// API handler
const handler = (req: Request) => {
  const result = CreateRequestSchema.safeParse(req.body);
  if (!result.success) return badRequest(result.error);
  // result.data is type-safe. No `as` cast needed from here on
};
```

### Do not use type assertions (`as`)

`as` bypasses type checks and causes runtime errors. Use schema parsing for external data; trust type inference for internal data.

### PII Protection

Apply a `Sensitive<T>` wrapper to fields containing personal information to automatically mask them in `JSON.stringify` and `console.log`.

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

Auto-wrap using a validation schema. The following example uses Zod; see the [validation library guides](./validation-libraries/) for Valibot and ArkType equivalents.

```typescript
const sensitiveString = z.string().transform(Sensitive.of);

const PatientSchema = z.object({
  name: sensitiveString,
  email: sensitiveString,
  role: z.string(), // not PII, so left as-is
});
```

Details: [boundary-defense.md](./boundary-defense.md)

## 5. Declarative Style

### Array Operations

Write array transformations declaratively using `filter` / `map` / `reduce`. Define predicate functions in the Companion Object.

```typescript
type Task = ActiveTask | CompletedTask;

const Task = {
  isActive: (task: Task): task is ActiveTask => task.kind === "Active",
} as const;

// Declarative: intent is clear
const activeTasks = tasks.filter(Task.isActive);

// Imperative: you have to read the loop body to understand the intent
const activeTasks: ActiveTask[] = [];
for (const task of tasks) {
  if (task.kind === "Active") activeTasks.push(task);
}
```

### Domain Events

Generate domain events that accompany state changes as immutable records, and record them separately from the repository.

```typescript
type DomainEvent = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: string;
  payload: unknown;
  aggregateId: string;
}>;
```

Details: [state-modeling.md](./state-modeling.md)

## 6. Test Data

Define dummy test data in a type-safe way using `as const satisfies Type`. This preserves discriminant literal types and prevents widening.

```typescript
const waitingRequest = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;

// waitingRequest.kind is the "Waiting" literal type (not string)
```

## Applying These Principles

These are recommendations, not strict rules. You may use your judgment based on context, but if you deviate from a principle, explicitly state the reason in a comment.

Typical justified reasons to deviate:
- An external library requires class inheritance
- Immutable object creation cost is a performance concern
- A different pattern has been adopted by team agreement
