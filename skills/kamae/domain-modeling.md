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

  isActive: (request: TaxiRequest) =>
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
type TaskStore = {
  save: (task: Task) => Promise<void>;
};

// Bad: method notation — parameters become bivariant,
// allowing a narrower implementation like save(task: DoingTask) to pass type checks
type TaskStore = {
  save(task: Task): Promise<void>;
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

## Represent fixed value sets as enum-like objects

Represent a fixed set of values, such as a business classification or the list of strings an external input may contain, as an enum-like pair: an `as const` object and a union type with the same name. Do not hold the set as an array of `string` or as bare string constants. Do not use the TypeScript `enum` keyword.

```typescript
// Bad: the set of values does not appear in any type, so callers keep handling `string`
const SALES_CHANNELS: ReadonlyArray<string> = ["web", "store", "phone"];

const isSalesChannel = (value: string): boolean => SALES_CHANNELS.includes(value);

// Good: the object holds the values and the type is derived from it
const SalesChannel = {
  Web: "web",
  Store: "store",
  Phone: "phone",
} as const;

type SalesChannel = (typeof SalesChannel)[keyof typeof SalesChannel];
```

**Rationale:** An array typed as `ReadonlyArray<string>` erases the members, so `includes` returns only a `boolean` and the compiler does not narrow the value afterwards. The enum-like pair makes the members a type: a function that takes `SalesChannel` rejects any other string at compile time, and a `switch` over it can use `assertNever` for exhaustiveness. The `enum` keyword is excluded because a string enum type is nominal: the literal `"web"` is not assignable to it, so every schema output and test fixture would need a conversion.

### Narrow external input with a type guard or a schema

Narrow a `string` from an external input to the set with a type guard (`value is X`) or with a validation-library schema. Do not compare the input with a `string` array and then treat it as the set, and do not use a type assertion. [boundary-defense.md](./boundary-defense.md#banning-type-assertions-as) allows only `as const` and `as const satisfies Type`.

```typescript
// Good: the type guard narrows `string` to `SalesChannel` without an assertion
const isSalesChannel = (value: string): value is SalesChannel =>
  Object.values(SalesChannel).some((member) => member === value);

// Good: a schema narrows unknown input (Zod 4 shown; use the detected library guide for others)
const SalesChannelSchema = z.enum(SalesChannel);
```

```typescript
// Bad: `includes` returns a boolean, so `raw` stays `string` afterwards
const handle = (raw: string) => {
  if (SALES_CHANNELS.includes(raw)) {
    return register(raw); // register takes SalesChannel, so this is a compile error
  }
};

// Bad: the assertion claims a type that nothing has checked
const channel = raw as SalesChannel;
```

Keep the guard out of the enum-like object. Functions placed inside it would add their names to `keyof typeof SalesChannel` and therefore to the union type. Define the guard as a standalone function in the same file, following the one-concept-per-file rule below. The general rule for grouping functions under the same-named object is in [Companion Object Pattern](#companion-object-pattern); this pair is the exception because its object is the value set itself.

### Separate value sets that are handled differently

When some values are processed and others are deliberately not processed, define one constant and one type for each group. The types then tell the two groups apart.

```typescript
const ImportableStatus = {
  Active: "active",
  Pending: "pending",
} as const;
type ImportableStatus = (typeof ImportableStatus)[keyof typeof ImportableStatus];

const SkippedStatus = {
  Archived: "archived",
  Draft: "draft",
} as const;
type SkippedStatus = (typeof SkippedStatus)[keyof typeof SkippedStatus];

// Only importable values reach this function
const importRow: (status: ImportableStatus, row: Row) => ImportedRow = /* ... */;
```

**Rationale:** A single list that mixes both groups forces every caller to re-check which members to process. With two types, passing a `SkippedStatus` to `importRow` is a compile error, and the decision about which group a raw value belongs to is made once, at the boundary, by the two type guards.

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

## Separate resolvers and stores by operation

Keep read contracts (resolvers) separate from write contracts (stores). Prefer one method per resolver or store, named and typed for the operation its consumer needs. Do not start with an entity-wide repository or add methods to complete a CRUD interface. Splitting a repository into one multi-method reader and one multi-method writer is only a first step; split independent lookups and writes into their own contracts as well.

```typescript
type TaskByIdResolver = Readonly<{
  findById: (id: TaskId) => Promise<Task | undefined>;
}>;

type TasksByAssigneeResolver = Readonly<{
  findByAssignee: (assigneeId: UserId) => Promise<readonly Task[]>;
}>;

type TaskStore = Readonly<{
  save: (task: Task) => Promise<void>;
}>;

type TaskEventStore = Readonly<{
  append: (events: readonly TaskEvent[]) => Promise<void>;
}>;
```

These declarations belong in separate concept files. A consumer that only appends events receives `TaskEventStore`; it needs neither a resolver nor a state store. A consumer that reads a task and saves its updated state receives `TaskByIdResolver` and `TaskStore` separately. `findById`, `resolve`, `save`, and `append` are all valid names when they describe the required operation; the concern is the scope of the contract, not a particular method name.

Keep I/O at the workflow edges: resolve required inputs, pass values into pure decisions, then persist the returned state or events. Pass time and generated IDs as values too. Injecting an I/O interface into a function does not make that function pure. If later I/O depends on a decision, let the orchestration alternate explicit I/O and pure steps. See Scott Wlaschin's [dependency rejection](https://fsharpforfunandprofit.com/posts/dependencies/#approach-2-dependency-rejection) for this workflow structure.

The composition root may assemble several contracts, and adapters may share a database client or transaction. Each consumer still receives only its required contracts; do not recombine them into a broad repository or service locator. One atomic write of state and its events is one operation and belongs in one store method; see [state-modeling.md](./state-modeling.md#persist-state-and-events-in-the-same-transaction). Respect an explicit project requirement for a broader existing contract, and explain the trade-off instead of adding unrelated operations by convention.

## Place ports in the domain layer

A port is a contract for a dependency needed by a workflow, such as a resolver, store, clock, or ID generator. The domain owns that contract. Place it beside the domain concept it serves, following the package's existing domain organization and one-concept-per-file rule. Calling a type a "port" does not introduce another layer: do not create a dedicated `port/` or `ports/` directory at the top level, under `application/`, or even under `domain/`.

For example, in a package organized by domain concept:

```text
src/
  domain/task/
    task.ts
    task-id.ts
    task-by-id-resolver.ts   # One read operation, expressed in domain types
    task-store.ts            # One write operation, expressed in domain types
  application/
    complete-task.ts         # Receives the resolver and store separately
  infrastructure/
    postgres-task-by-id-resolver.ts  # Implements the read contract
    postgres-task-store.ts          # Implements the write contract
  main.ts                   # Wires the adapter into the use case
```

A flat domain layout can use `src/domain/task-store.ts` instead. Keep each contract with its owning concept, not in a generic `src/ports/task-store.ts` or `src/domain/ports/task-store.ts` collection.

Use cases and concrete adapters import the contract from the domain. The contract uses domain types and does not import the adapter, database client, or external SDK types. Keep concrete I/O and external-data mapping in the infrastructure adapter, and wire implementations at the composition root. Defining a contract in the domain does not put I/O into pure domain transitions; the use case invokes the injected dependency.
