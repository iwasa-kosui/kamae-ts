---
title: Code Review
description: An adversarial review guide for server-side TypeScript code grounded in the kamae-ts principles
parent: English
nav_order: 7
---

# Functional TypeScript Code Review

A guide for reviewing server-side TypeScript code against the kamae-ts principles (see [index](./index.md)). Each checklist item maps one-to-one to a chapter of the principles.

> This guide is a human-readable version of the checklist used internally by the `kamae-review` skill in the [kamae-ts plugin](https://github.com/iwasa-kosui/kamae-ts). Use it as a reference when reviewing manually without a coding agent.

## Review Procedure

1. **Read the principle knowledge base first.** Before looking at code, read the following so you can cite canonical principles in your findings:
   - [index.md](./index.md) — principle index
   - [error-handling.md](./error-handling.md)
   - [boundary-defense.md](./boundary-defense.md)
   - [state-modeling.md](./state-modeling.md)
   - The validation-library guide matching the project's `package.json` ([validation-libraries/](./validation-libraries/) — `zod.md` / `valibot.md` / `arktype.md`)
   - The Result-library guide matching the project's `package.json` ([result-libraries/](./result-libraries/) — `neverthrow.md` / `byethrow.md` / `fp-ts.md` / `option-t.md`)
2. Read the files under review.
3. Scan through the checklist items below in principle order (matching the chapter structure of [index.md](./index.md)).
4. When you find a violation, report it with the principle, the reason it matters, and a suggested fix.
5. When something is not a violation but could be improved, present it as a suggestion.

## Checklist

The checklist directly mirrors the structure of [index.md](./index.md). Each item links back to the canonical chapter.

### 1. Type-Driven Domain Modeling

#### 1.1 Domain state modeled as a Discriminated Union

Reference: [`./index.md` §1 "Express domain state with Discriminated Unions"](./index.md)

Signal: a single type with many optional properties and a `string` status field (e.g. `{ state: string; driverId?: string; startTime?: Date }`). Suggest splitting into per-state types combined into a union, making state-specific properties required.

#### 1.2 Discriminant unified as `kind`

Reference: [`./index.md` §1 "Use `kind` as the unifying discriminant"](./index.md)

Signal: a discriminant named `type`, `status`, `state`, `_tag`, or anything other than `kind`. Suggest renaming to `kind` for codebase consistency.

#### 1.3 No use of `class` for domain models

Reference: [`./index.md` §1 "Express domain state with Discriminated Unions"](./index.md) and the Companion Object pattern.

When `class` is used to define a domain entity or value object, suggest migrating to a Discriminated Union + Companion Object pattern. Class inheritance required by an external library is a justified deviation.

#### 1.4 Companion Object pattern followed

Reference: [`./index.md` §1 "Companion Object pattern"](./index.md)

Verify:
- Operations related to a type are consolidated in a `const` with the same name as the type.
- A Branded Type's validation schema is exposed as a `.schema` property on the companion object, not as a standalone `XxxSchema` export.
- Domain logic that belongs on the companion object is not scattered as free-standing functions like `xxxAssignDriver`.

#### 1.5 No `interface` for domain types

Reference: [`./index.md` §1 "Use `type`, not `interface`"](./index.md)

Declaration merging can silently alter a type's shape. Define domain types with `type`. `interface` is only acceptable for library type augmentation.

#### 1.6 No method notation in type definitions

Reference: [`./index.md` §1 "Use function-property notation, not method notation"](./index.md)

Method notation (`save(task: Task): Promise<void>`) makes parameters bivariant, allowing a narrower implementation (`save(task: DoingTask): …`) to pass type-checking at the injection site. Suggest switching to function-property notation (`save: (task: Task) => Promise<void>`).

#### 1.7 Branded Types applied to semantically distinct primitives

Reference: [`./index.md` §1 "Use Branded Types to distinguish meaning"](./index.md). Also see the project's validation-library guide ([`./validation-libraries/`](./validation-libraries/)).

Signal: IDs or semantically distinct values (`UserId`, `OrderId`, `Email`, monetary amounts, etc.) represented as plain `string` / `number`. If a validation library is present, verify that its branding feature is used (no `as` cast needed); otherwise confirm the `unique symbol` pattern is in place.

#### 1.8 Domain objects wrapped in `Readonly<>`

Reference: [`./index.md` §1 "Use `Readonly<>` to guarantee immutability"](./index.md)

Signal: domain object type definitions not protected by `Readonly<…>` (or per-property `readonly`). State changes should be expressed by constructing new objects.

#### 1.9 One-concept-per-file layout

Reference: [`./index.md` §1 "File layout: one concept per file"](./index.md)

Signal: catch-all files such as `types.ts`, `models.ts`, or `domain.ts` that aggregate many domain types, especially when companion objects live in separate files. Barrel files (`index.ts`) should contain re-exports only.

### 2. State Transitions via Pure Functions

Reference: [`./index.md` §2](./index.md) and [`./state-modeling.md`](./state-modeling.md)

#### 2.1 Transition functions constrain the source state via argument types

Signal: a transition function's argument type is the full union (`TaxiRequest`) rather than an individual state (`Waiting`). Accepting a wide type allows calls from invalid source states.

#### 2.2 `assertNever` present in `switch` over a Discriminated Union

Reference: [`./index.md` §2 "Exhaustiveness check"](./index.md)

Signal: a `switch` branching on `kind` without `default: return assertNever(x)`. Adding a new variant will not produce a compile error.

### 3. Error Handling — Railway Oriented Programming

Reference: [`./index.md` §3](./index.md), [`./error-handling.md`](./error-handling.md), and the project's Result-library guide ([`./result-libraries/`](./result-libraries/)).

#### 3.1 No `throw` in the domain layer

Signal: `throw` inside an entity, value object, or use case. Suggest converting to a `Result` type. Acceptable exceptions: `throw` inside `assertNever` (unreachable), and unexpected infrastructure failures in the infrastructure layer.

#### 3.2 Error types defined as Discriminated Unions

Signal: `Error` subclasses, free-form `string` error codes, or `Result<T, string>`. Suggest a Discriminated Union (`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`) so callers can handle errors exhaustively.

#### 3.3 Result chains used for composition (no premature unwrap)

Verify that the project's Result-library API (`.map`, `.andThen`, `Result.do`, etc.) is used for chained composition. If the code immediately unwraps into `if/else`, cite the relevant guide under `./result-libraries/` and suggest an appropriate combinator.

### 4. Boundary Defense

Reference: [`./index.md` §4](./index.md), [`./boundary-defense.md`](./boundary-defense.md), and the project's validation-library guide ([`./validation-libraries/`](./validation-libraries/)).

#### 4.1 Schema validation at every external boundary

Signal: API handlers, DB result mappings, queue/message handlers, file/config reads, or environment-variable reads where raw data is treated as a domain type without being parsed through a validation library (Zod / Valibot / ArkType).

#### 4.2 No `as` type assertions

Reference: [`./index.md` §4 "Do not use type assertions (`as`)"](./index.md)

Enumerate every `as` and verify it falls into one of:
- External data: should be replaced with schema parsing.
- `as` inside a Branded Type constructor: acceptable only when not using a validation library (the `unique symbol` pattern).
- Internal data: should be resolvable via type inference. If not, the type design is likely wrong.

#### 4.3 PII fields wrapped in `Sensitive<T>`

Reference: [`./index.md` §4 "PII defense"](./index.md), [`./boundary-defense.md`](./boundary-defense.md)

Signal: fields that may contain personal information (name, email address, phone number, address, various IDs, payment information, health/diagnostic information, IP address, etc.) represented as plain `string` / `number`. Pay particular attention to objects that may appear in logs or error messages. Also check that the validation schema automatically wraps PII fields with `Sensitive.of`.

### 5. Declarative Style

Reference: [`./index.md` §5](./index.md), [`./state-modeling.md`](./state-modeling.md)

#### 5.1 Array operations written declaratively

Signal: transformations expressible with `filter` / `map` / `reduce` being built imperatively with `for` / `for…of` loops. Suggest defining predicate functions on the companion object and writing `tasks.filter(Task.isActive)`.

#### 5.2 Domain events published as immutable records

Signal: state-mutation code directly mutating a shared event log, or domain events not being published where the state-modeling guide requires them. Events should be recorded as `Readonly<{ eventId; eventAt; eventName; payload; aggregateId }>`, separated from the repository.

#### 5.3 Companion-object predicates free of redundant `x is Y` annotations

Signal: predicate functions over a discriminated union that carry an explicit `: x is Y` return-type annotation when the body is just `kind === "..."` comparisons (or their `!==` negation). TypeScript 5.5+ infers the type predicate from such bodies and `Array.prototype.filter` consumes the inferred predicate, so the annotation adds nothing — and falsely implies that discriminated union narrowing alone is insufficient. Suggest dropping the annotation.

### 6. Test Data

Reference: [`./index.md` §6](./index.md)

#### 6.1 Fixtures defined with `as const satisfies Type`

Signal: test fixtures typed with `: Type =` or `as Type`, causing discriminant literal types to widen to `string`. Suggest `as const satisfies Type` to preserve the `kind` literal type.

## How to Write Findings

Each finding should include:

1. **What is wrong**: the specific code location (`path:line`).
2. **Why it matters**: the principle (with a reference link to `./...`) and the risk introduced by the violation.
3. **How to fix it**: a code example showing the suggested fix.

```
### Method notation used

`src/repository/task-repository.ts:15`

`save(task: Task): Promise<void>` uses method notation.
Per [`./index.md` §1 "Use function-property notation"](./index.md),
method notation makes parameters bivariant, so a narrower implementation
`save(task: DoingTask): Promise<void>` would pass type-checking at the injection site.

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
| [High] | `as` type assertions (4.2) | Direct cause of runtime errors |
| [High] | Unprotected PII (4.3) | Compliance violation risk |
| [High] | Missing schema validation at external boundaries (4.1) | Direct cause of runtime errors |
| [High] | Missing Branded Types for semantically distinct primitives (1.7) | Mixed-up IDs surface at runtime |
| [Medium] | Use of `class` (1.3) | Degrades type safety during extension |
| [Medium] | State modeled with optional properties (1.1) | Invalid states become representable |
| [Medium] | `throw` in the domain layer (3.1) | Inconsistent error handling |
| [Medium] | Error type not a Discriminated Union (3.2) | Callers cannot handle errors exhaustively |
| [Medium] | Missing `assertNever` (2.2) | New variants go undetected at compile time |
| [Medium] | Transition function accepts the full union type (2.1) | Invalid transitions compile without error |
| [Medium] | Catch-all type files (1.9) | Circular dependencies; type/behavior separation |
| [Medium] | Companion Object pattern violated; schema exported standalone (1.4) | Leaks implementation details |
| [Low] | Method notation (1.6) | Only problematic under specific conditions |
| [Low] | `interface` for domain types (1.5) | Declaration-merging accidents are rare |
| [Low] | Domain types missing `Readonly<>` (1.8) | Mutations are often caught in review |
| [Low] | Discriminant is not `kind` (1.2) | Style inconsistency rather than a bug |
| [Low] | Imperative array loops (5.1) | Readability, not correctness |
| [Low] | Domain events not published (5.2) | Depends on whether event sourcing is adopted |
| [Low] | Redundant `x is Y` predicate annotation (5.3) | Wastes characters; misleads about discriminated union narrowing |
| [Low] | Fixtures missing `as const satisfies` (6.1) | Typically caught by tests in practice |
