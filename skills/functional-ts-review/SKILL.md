---
name: functional-ts-review
description: Use when reviewing TypeScript server-side code for adherence to functional domain modeling principles. Checks the same principles enforced by the `functional-ts` skill — discriminated unions, companion objects, branded types, immutability, file structure, pure state transitions, exhaustiveness, Result-based error handling, boundary defense (schema validation, no `as`, PII protection), declarative style, and type-safe test data.
license: MIT
---

# Functional TypeScript Code Review

Review server-side TypeScript code against the functional domain modeling principles defined in the `functional-ts` skill. This review uses the **same knowledge base** as `functional-ts` — every checklist item below corresponds to a section of that skill, and links to the authoritative description there.

## Review Procedure

1. **Load the principle knowledge first.** Before reading any code under review, read the following so that findings cite the canonical principle:
   - [`../functional-ts/SKILL.md`](../functional-ts/SKILL.md) — the principle index
   - [`../functional-ts/error-handling.md`](../functional-ts/error-handling.md)
   - [`../functional-ts/boundary-defense.md`](../functional-ts/boundary-defense.md)
   - [`../functional-ts/state-modeling.md`](../functional-ts/state-modeling.md)
   - The validation library guide matching the project's `package.json` under [`../functional-ts/validation-libraries/`](../functional-ts/validation-libraries/) (`zod.md` / `valibot.md` / `arktype.md`)
   - The Result library guide matching the project's `package.json` under [`../functional-ts/result-libraries/`](../functional-ts/result-libraries/) (`neverthrow.md` / `byethrow.md` / `fp-ts.md` / `option-t.md`)
2. Read the files under review.
3. Walk through the checklist below in the order of the principles. The numbering mirrors `functional-ts/SKILL.md`.
4. When a violation is found, report it with the relevant principle, the reason it matters, and a fix.
5. When something is not a violation but has room for improvement, communicate it as a suggestion.

## Checklist

The checklist mirrors the structure of [`../functional-ts/SKILL.md`](../functional-ts/SKILL.md). Each item links back to the authoritative description.

### 1. Type-Driven Domain Modeling

#### 1.1 Are domain states modeled as Discriminated Unions?

Reference: [`../functional-ts/SKILL.md` §1 "Represent State with Discriminated Unions"](../functional-ts/SKILL.md)

Flag: a single type with many `optional` properties and a `string` state field (e.g. `{ state: string; driverId?: string; startTime?: Date }`). Suggest splitting into per-state types unioned together so state-specific properties become required.

#### 1.2 Is `kind` used as the unified discriminant?

Reference: [`../functional-ts/SKILL.md` §1 "Use `kind` as the unified discriminant"](../functional-ts/SKILL.md)

Flag: discriminant property names other than `kind` (`type`, `status`, `state`, `_tag`, …). Suggest renaming to `kind` for codebase consistency.

#### 1.3 Are classes used for domain models?

Reference: [`../functional-ts/SKILL.md` §1 "Represent State with Discriminated Unions"](../functional-ts/SKILL.md), and the Companion Object pattern.

If `class` defines domain entities or value objects, suggest migrating to Discriminated Union + Companion Object. Class inheritance required by an external library is a legitimate exception.

#### 1.4 Is the Companion Object pattern followed?

Reference: [`../functional-ts/SKILL.md` §1 "Companion Object Pattern"](../functional-ts/SKILL.md)

Check that:
- A type's related operations live on a `const` of the same name as the type.
- Branded Type validation schemas are exposed as `.schema` on the companion object, not as standalone `XxxSchema` exports.
- Domain logic is not scattered as free-standing `xxxAssignDriver` helpers when a companion object would naturally own them.

#### 1.5 Is `interface` used for domain types?

Reference: [`../functional-ts/SKILL.md` §1 "Use `type` (not `interface`)"](../functional-ts/SKILL.md)

Declaration merging silently changes a type's shape. Domain types must be `type`. `interface` is acceptable only for library type augmentation.

#### 1.6 Is method notation used inside type definitions?

Reference: [`../functional-ts/SKILL.md` §1 "Use function property notation (not method notation)"](../functional-ts/SKILL.md)

Method notation (`save(task: Task): Promise<void>`) makes parameters bivariant, allowing a narrower implementation (`save(task: DoingTask): …`) to type-check at injection sites. Suggest function property notation (`save: (task: Task) => Promise<void>`).

#### 1.7 Are Branded Types applied to semantically distinct primitives?

Reference: [`../functional-ts/SKILL.md` §1 "Distinguish meaning with Branded Types"](../functional-ts/SKILL.md), plus the project's validation library guide under [`../functional-ts/validation-libraries/`](../functional-ts/validation-libraries/).

Flag: `string` / `number` used directly for IDs and semantically distinct values (`UserId`, `OrderId`, `Email`, money amounts, …). Verify that brands use the validation library's brand feature when one is present (so `as` casts are unnecessary), or the `unique symbol` pattern when no library is used.

#### 1.8 Are domain objects `Readonly<>`?

Reference: [`../functional-ts/SKILL.md` §1 "Ensure immutability with `Readonly<>`"](../functional-ts/SKILL.md)

Flag: domain object types defined without `Readonly<…>` (or `readonly` per-property). State changes should produce new objects, not mutate properties.

#### 1.9 Is the "one concept per file" rule followed?

Reference: [`../functional-ts/SKILL.md` §1 "File structure: one concept per file"](../functional-ts/SKILL.md)

Flag: catch-all files (`types.ts`, `models.ts`, `domain.ts`) aggregating many domain types, especially when companion objects live elsewhere. Barrel files (`index.ts`) must only re-export.

### 2. State Transitions via Functions

Reference: [`../functional-ts/SKILL.md` §2](../functional-ts/SKILL.md) and [`../functional-ts/state-modeling.md`](../functional-ts/state-modeling.md)

#### 2.1 Do state transitions constrain source states by argument type?

Flag: a transition function whose argument type is the union (`TaxiRequest`) instead of the specific source state (`Waiting`). The wider type allows callers to apply the transition to invalid source states.

#### 2.2 Do `switch` statements over Discriminated Unions have `assertNever`?

Reference: [`../functional-ts/SKILL.md` §2 "Exhaustiveness Checking"](../functional-ts/SKILL.md)

Flag: `switch` on `kind` without `default: return assertNever(x)`. Without it, adding a new variant will not produce a compile error.

### 3. Error Handling — Railway Oriented Programming

Reference: [`../functional-ts/SKILL.md` §3](../functional-ts/SKILL.md), [`../functional-ts/error-handling.md`](../functional-ts/error-handling.md), and the project's Result library guide under [`../functional-ts/result-libraries/`](../functional-ts/result-libraries/).

#### 3.1 Are exceptions thrown in the domain layer?

Flag: `throw` in entities, value objects, or use cases. Suggest migrating to `Result`. Acceptable: `throw` inside `assertNever` (unreachable) and unexpected failures in the infrastructure layer.

#### 3.2 Are error types Discriminated Unions?

Flag: `Error` subclasses, free-form `string` error codes, or `Result<T, string>`. Suggest a Discriminated Union (`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`) so callers can branch exhaustively.

#### 3.3 Are Result chains used instead of nested if/else?

Verify that the project uses the matching Result library API (`.map`, `.andThen`, `Result.do`, …) rather than unwrapping immediately into branching code. Cite the matching guide under `../functional-ts/result-libraries/` for the correct combinator.

### 4. Boundary Defense

Reference: [`../functional-ts/SKILL.md` §4](../functional-ts/SKILL.md), [`../functional-ts/boundary-defense.md`](../functional-ts/boundary-defense.md), and the project's validation library guide under [`../functional-ts/validation-libraries/`](../functional-ts/validation-libraries/).

#### 4.1 Is schema validation present at every external boundary?

Flag: API handlers, DB-result mappers, queue/message handlers, file/config loaders, or env-var readers that treat raw data as domain types without parsing it through a validation library schema (Zod / Valibot / ArkType).

#### 4.2 Are `as` type assertions used?

Reference: [`../functional-ts/SKILL.md` §4 "Do not use type assertions (`as`)"](../functional-ts/SKILL.md)

Flag every `as` and verify it falls into one of these acceptable cases:
- External data: must be replaced by a validation schema parse.
- `as` inside a Branded Type factory: acceptable when no validation library is used (`unique symbol` pattern).
- Internal data: type inference should resolve it; if not, the type design is likely wrong.

#### 4.3 Do PII fields use `Sensitive<T>`?

Reference: [`../functional-ts/SKILL.md` §4 "PII Protection"](../functional-ts/SKILL.md), [`../functional-ts/boundary-defense.md`](../functional-ts/boundary-defense.md)

Flag: fields plausibly carrying personal information (name, email, phone, address, government IDs, payment details, health/diagnostic information, IP addresses) that are bare `string`/`number` rather than `Sensitive<T>`. Pay special attention to objects that may appear in logs or error messages. Verify that the validation schema auto-wraps such fields with `Sensitive.of`.

### 5. Declarative Style

Reference: [`../functional-ts/SKILL.md` §5](../functional-ts/SKILL.md), [`../functional-ts/state-modeling.md`](../functional-ts/state-modeling.md)

#### 5.1 Are array operations declarative?

Flag: `for` / `for…of` loops that build up arrays imperatively when `filter` / `map` / `reduce` would express the intent directly. Suggest defining predicates on the companion object (e.g., `tasks.filter(Task.isActive)`).

#### 5.2 Are domain events emitted as immutable records?

Flag: state-change code that mutates a shared event log, or that omits domain events entirely when the state-modeling guidance calls for them. Events should be `Readonly<{ eventId; eventAt; eventName; payload; aggregateId }>` and recorded separately from the repository.

### 6. Test Data

Reference: [`../functional-ts/SKILL.md` §6](../functional-ts/SKILL.md)

#### 6.1 Is `as const satisfies Type` used for fixtures?

Flag: test fixtures typed with `: Type =` or with `as Type`, which widen discriminant literals to `string`. Suggest `as const satisfies Type` so `kind` keeps its literal type.

## How to Write Findings

Each finding should include:

1. **What the problem is**: the specific location in the code (`path:line`).
2. **Why it is a problem**: the principle (with a link back to `../functional-ts/...`) and the risk of violating it.
3. **How to fix it**: a code example showing the corrected version.

```
### Use of method notation

`src/repository/task-repository.ts:15`

`save(task: Task): Promise<void>` uses method notation. Per
[`../functional-ts/SKILL.md` §1 "Use function property notation"](../functional-ts/SKILL.md),
parameters become bivariant under method notation, so a narrower implementation such as
`save(task: DoingTask): Promise<void>` will pass type checking at the injection site.

Suggested fix:
\`\`\`typescript
type TaskRepository = {
  save: (task: Task) => Promise<void>;
};
\`\`\`
```

## Severity

| Severity | Item | Reason |
|----------|------|--------|
| High | `as` type assertions (4.2) | Direct cause of runtime errors |
| High | Unprotected PII (4.3) | Risk of compliance violations |
| High | Missing schema validation at external boundaries (4.1) | Direct cause of runtime errors |
| High | Missing Branded Types on semantically distinct primitives (1.7) | Cross-domain ID confusion at runtime |
| Medium | Class usage (1.3) | Reduced type safety when extended |
| Medium | Optional-property state modeling instead of Discriminated Union (1.1) | Invalid states become representable |
| Medium | Use of `throw` in domain layer (3.1) | Inconsistent error handling |
| Medium | Non-Discriminated-Union error types (3.2) | Callers cannot branch exhaustively |
| Medium | Missing `assertNever` (2.2) | New variants slip through unhandled |
| Medium | State transitions accepting the union type (2.1) | Invalid transitions compile |
| Medium | Catch-all type files (1.9) | Circular dependencies, separation of types from behavior |
| Medium | Companion Object violations / standalone schema export (1.4) | Implementation detail leakage |
| Low | Method notation (1.6) | Issue only manifests under specific conditions |
| Low | `interface` usage for domain types (1.5) | Declaration merging accidents are rare |
| Low | Non-`Readonly<>` domain types (1.8) | Mutation is usually caught in review even without the type |
| Low | Discriminant other than `kind` (1.2) | Stylistic inconsistency rather than a defect |
| Low | Imperative array loops (5.1) | Readability rather than correctness |
| Low | Missing domain events (5.2) | Depends on whether event sourcing is in scope |
| Low | Fixtures without `as const satisfies` (6.1) | Caught by tests in practice |
