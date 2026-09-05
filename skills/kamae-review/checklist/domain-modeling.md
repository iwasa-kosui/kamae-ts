# Domain Modeling Checklist

Reference: [`../../kamae/SKILL.md` §1](../../kamae/SKILL.md), [`../../kamae/domain-modeling.md`](../../kamae/domain-modeling.md), and the project's validation library guide under [`../../kamae/validation-libraries/`](../../kamae/validation-libraries/).

## 1.1 Are domain states modeled as Discriminated Unions? — Medium

Flag: a single type with many `optional` properties and a `string` state field (e.g. `{ state: string; driverId?: string; startTime?: Date }`). Suggest splitting into per-state types unioned together so state-specific properties become required.

## 1.2 Is `kind` used as the unified discriminant? — Low

Flag: discriminant property names other than `kind` (`type`, `status`, `state`, `_tag`, …). Suggest renaming to `kind` for codebase consistency.

## 1.3 Are classes used for domain models? — Medium

If `class` defines domain entities or value objects, suggest migrating to Discriminated Union + Companion Object. Class inheritance required by an external library is a legitimate exception.

## 1.4 Is the Companion Object pattern followed? — Medium

Check that:
- A type's related operations live on a `const` of the same name as the type.
- Branded Type validation schemas are exposed as `.schema` on the companion object, not as standalone `XxxSchema` exports.
- Domain logic is not scattered as free-standing `xxxAssignDriver` helpers when a companion object would naturally own them.

## 1.5 Is `interface` used for domain types? — Low

Declaration merging silently changes a type's shape. Domain types must be `type`. `interface` is acceptable only for library type augmentation.

## 1.6 Is method notation used inside type definitions? — Low

Method notation (`save(task: Task): Promise<void>`) makes parameters bivariant, allowing a narrower implementation (`save(task: DoingTask): …`) to type-check at injection sites. Suggest function property notation (`save: (task: Task) => Promise<void>`).

## 1.7 Are Branded Types applied to semantically distinct primitives? — High

Flag: `string` / `number` used directly for IDs and semantically distinct values (`UserId`, `OrderId`, `Email`, money amounts, …). Verify that brands use the validation library's brand feature when one is present (so `as` casts are unnecessary), or the `unique symbol` pattern when no library is used.

## 1.8 Are domain objects `Readonly<>`? — Low

Flag: domain object types defined without `Readonly<…>` (or `readonly` per-property). State changes should produce new objects, not mutate properties.

## 1.9 Is the "one concept per file" rule followed? — Medium

Flag: catch-all files (`types.ts`, `models.ts`, `domain.ts`) aggregating many domain types, especially when companion objects live elsewhere. Barrel files (`index.ts`) must only re-export.

## 1.10 Are domain-facing ports owned by the domain layer? — Low / Medium

Flag: repository, resolver, store, or other domain-facing dependency contracts defined outside the domain layer or collected in a dedicated `port/` or `ports/` directory, including `domain/ports/`. Recommend placing each contract beside the domain concept it serves (for example, `src/domain/task/task-store.ts`). Use cases and adapters should import that domain-owned contract; concrete I/O implementations remain in infrastructure.

Treat placement alone as Low. Raise to Medium when the domain contract imports an infrastructure implementation, database client, or external SDK type, and cite that dependency. Do not infer a dependency violation or runtime failure from a directory name alone. A concrete repository adapter correctly placed in infrastructure is not a misplaced port; inspect whether the file defines the contract or implements it. Respect explicit project overrides loaded in Step 0.

## 1.11 Are resolvers and stores separate and scoped to one operation? — Low

Flag: an injected contract combines reads and writes, or a resolver/store exposes multiple independent operations without a documented project reason. Recommend separate read and write contracts, preferably one method each, with each consumer receiving only what it uses. Cite the contract and the affected consumer; an event-only writer must not need read methods, and two unrelated queries should not become a multi-method resolver by default.

Judge responsibilities, not names: `findById` is valid on a single-operation resolver, and a single-operation contract named `Repository` is not itself a violation. Sharing an adapter's database client or assembling several separate contracts at the composition root is fine. Keep an atomic state-and-events write in one store method; do not split its transaction. Respect explicit project overrides and explain only the remaining trade-off when a broader contract is required.
