# Type-Driven Domain Modeling Detailed Guide

## Represent State with Discriminated Unions

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

## Use `kind` as the unified discriminant

Use `kind` as the discriminant property name throughout the entire project. Mixing `type`, `status`, `state`, etc. undermines codebase consistency.

## Companion Object Pattern

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

## Use `type` (not `interface`)

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

## Use function property notation (not method notation)

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

## Distinguish meaning with Branded Types

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

## Ensure immutability with `Readonly<>`

Define domain objects with `Readonly<>` to prevent property reassignment. Express state changes by creating new objects.

## File structure: one concept per file

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
