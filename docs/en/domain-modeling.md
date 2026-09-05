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
type TaskRepository = {
  save: (task: Task) => Promise<void>;
  findById: (id: TaskId) => Promise<Task | undefined>;
};

// Bad: method notation — parameters become bivariant, so a narrower
// implementation like save(task: DoingTask) passes the type checker
type TaskRepository = {
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | undefined>;
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

## Place Ports in the Domain Layer

A port is a contract for a dependency needed by the domain or its use cases, such as a repository, resolver, store, clock, or ID generator. The domain owns that contract. Place it beside the domain concept it serves, following the package's existing domain organization and one-concept-per-file rule. Calling a type a "port" does not introduce another layer: do not create a dedicated `port/` or `ports/` directory at the top level, under `application/`, or even under `domain/`.

For example, in a package organized by domain concept:

```text
src/
  domain/task/
    task.ts
    task-id.ts
    task-repository.ts       # Contract expressed in domain types
  application/
    complete-task.ts         # Receives TaskRepository as a dependency
  infrastructure/
    postgres-task-repository.ts  # Implements the domain contract
  main.ts                   # Wires the adapter into the use case
```

A flat domain layout can use `src/domain/task-repository.ts` instead. Keep each contract with its owning concept, not in a generic `src/ports/task-repository.ts` or `src/domain/ports/task-repository.ts` collection.

Use cases and concrete adapters import the contract from the domain. The contract uses domain types and does not import the adapter, database client, or external SDK types. Keep concrete I/O and external-data mapping in the infrastructure adapter, and wire implementations at the composition root. Defining a contract in the domain does not put I/O into pure domain transitions; the use case invokes the injected dependency.
