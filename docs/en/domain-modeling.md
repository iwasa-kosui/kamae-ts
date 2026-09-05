---
title: Type-Driven Domain Modeling
parent: English
nav_order: 1
---

# Type-Driven Domain Modeling — Detailed Guide

## Expressing State with Discriminated Unions

Model domain entity state with Discriminated Unions, not classes. Define each state as a distinct type and make state-specific properties required.

```typescript
// Good: each state is an independent type; state-specific properties are required
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
// Bad: all states collapsed into one type via optional properties
type TaxiRequest = {
  state: string;
  passengerId: string;
  driverId?: string;    // unclear which states this exists in
  startTime?: Date;     // null checks required everywhere
  endTime?: Date;
};
```

**Why:** Optional properties give no compile-time guarantee about which properties exist in which state. With a Discriminated Union, narrowing on `kind` in a switch statement gives you safe access to state-specific properties immediately.

## Use `kind` as the Discriminant

Use `kind` as the discriminant property name throughout the project. Mixing `type`, `status`, and `state` as discriminant names breaks codebase consistency.

## Companion Object Pattern

Group a type and its related functions under the same name as a `const` object. Validation schemas for Branded Types should be exposed as a `schema` property on the companion object rather than as standalone exports.

```typescript
// Bad: schema as a standalone export — leaks implementation details
export const ItemIdBrand = Symbol();
export const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();

// Good: companion object owns the schema
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

## Use `type`, Not `interface`

Define domain types with `type`. The declaration-merging behavior of `interface` means that declaring an interface with the same name in another file silently changes the shape of the type.

```typescript
// Good
type User = Readonly<{
  id: UserId;
  name: string;
}>;

// Bad: if another file declares `interface User { hashedPassword?: string }`,
// the type changes without any warning
interface User {
  id: string;
  name: string;
}
```

## Function-Property Notation, Not Method Notation

Write functions inside type definitions using function-property notation rather than method notation. Method notation makes parameter types bivariant, which breaks type safety.

```typescript
// Good: function-property notation — parameters are contravariant
type TaskStore = {
  save: (task: Task) => Promise<void>;
};

// Bad: method notation — parameters become bivariant, so a narrower
// implementation like save(task: DoingTask) passes the type checker
type TaskStore = {
  save(task: Task): Promise<void>;
};
```

## Branded Types for Semantic Distinction

TypeScript's structural subtyping makes two `string` values mutually assignable. Apply Branded Types to IDs and values that carry different meanings.

**Detecting your validation library:** Check `dependencies` / `devDependencies` in the project's `package.json` and follow the guide for whichever library is present. If none is found, ask the user.

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

When using a validation library, define Branded Types with its branding feature. The schema's output type is automatically branded, so no `as` cast is needed. Zod example:

```typescript
import { z } from "zod";

export const UserIdBrand = Symbol();
const UserIdSchema = z.string().uuid().brand<typeof UserIdBrand>();
type UserId = z.infer<typeof UserIdSchema>;

export const ProductIdBrand = Symbol();
const ProductIdSchema = z.string().uuid().brand<typeof ProductIdBrand>();
type ProductId = z.infer<typeof ProductIdSchema>;

// safeParse().data is already branded — no `as` needed
```

For projects that do not use a validation library, use the `unique symbol` pattern:

```typescript
export const UserIdBrand = Symbol();
type UserId = string & { readonly [typeof UserIdBrand]: never };

export const ProductIdBrand = Symbol();
type ProductId = string & { readonly [typeof ProductIdBrand]: never };
```

## `Readonly<>` for Immutability

Define domain objects with `Readonly<>` to prevent property reassignment. Express state changes by constructing a new object.

## File Layout: One Concept per File

Place each domain concept (type + companion object) in its own dedicated file. Catch-all files like `types.ts` or `models.ts` are not allowed — they separate types from behavior and become a source of circular dependencies.

```
// Bad: types aggregated in types.ts, companions in separate files
// types.ts — ItemId, ItemType, Status, Priority, Item, Config, ...
// item-id.ts — ItemId companion object (imports types from types.ts)

// Good: one file per concept
// item-id.ts — type ItemId + const ItemId (companion)
// item-type.ts — type ItemType + const ItemType (companion)
// status.ts — type Status + const Status (companion)
```

Barrel files (`index.ts`) are for re-exports only; do not define types or functions directly inside them.

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
