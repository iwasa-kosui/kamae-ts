---
name: kamae
description: |
  Kamae (構え) — robust server-side TypeScript design. Functional domain modeling with
  discriminated unions, pure state transitions, Result types, schema-validated boundaries,
  and PII protection.

  TRIGGER when: writing TypeScript domain models, use cases, repositories, state transitions,
  error handling, boundary validation, or PII handling on the server side; designing types
  for business logic; implementing entity/value-object semantics in TS.
  SKIP: frontend React/Vue components, browser code, build tooling, code generation scripts,
  pure infrastructure-as-code; code unrelated to domain logic.
license: MIT
---

# Kamae — Functional Domain Modeling in TypeScript

Six topic files cover the principles. Read only the file(s) relevant to the current task. The library guides under `result-libraries/` and `validation-libraries/` are read on demand based on the project's `package.json`.

## Step 0: Load applicable rules

Before any other step, glob and Read rules in priority order:

1. `.claude/rules/*.md` (project-level overrides at the working-tree root)
2. `~/.claude/rules/*.md` (user-global preferences)
3. `../../rules/defaults/*.md` relative to this `SKILL.md` (plugin defaults)

For each file:

- Read the YAML frontmatter. Skip the rule unless `applies-to` is `kamae` or `*`.
- Group by `name`. For each `name`, keep only the highest-tier instance (1 > 2 > 3); within a tier the lexicographically last filename wins.
- Apply the body of each surviving rule throughout the remaining steps. A `library-preference` rule overrides Step 1 detection; a `convention` rule shapes generated code; an `override` rule replaces guidance from a specific topic file.

If no rules are found, proceed with the plugin defaults already documented in [`../../rules/defaults/`](../../rules/defaults/).

See [`../../rules/README.md`](../../rules/README.md) for the rule format.

## Step 1: Detect project libraries

Read `package.json` once. Note which Result library and validation library are present:

- Result libraries — match the first present in priority `neverthrow` > `byethrow` > `fp-ts` > `option-t`. Load the matching guide under [`result-libraries/`](./result-libraries/) when error-handling is in scope.
- Validation libraries — match the first present in priority `zod` > `valibot` > `arktype`. Load the matching guide under [`validation-libraries/`](./validation-libraries/) when boundary or branded-type work is in scope.

If none are present, ask the user before proceeding.

## Step 2: Apply the topic relevant to the task

Each topic below is one file. Read it lazily — only the file(s) you need for the current task.

### Type-Driven Domain Modeling — [domain-modeling.md](./domain-modeling.md)

Represent states with discriminated unions using `kind` as the unified discriminant. Use `type` (not `interface`), Companion Object pattern, branded types via the project's validation library, `Readonly<>`, function property notation, and one-concept-per-file structure.

### State Transitions — [state-modeling.md](./state-modeling.md)

Express transitions with pure functions. Argument types constrain valid source states; return types make targets explicit. Invalid transitions become compile errors. Use `assertNever` for exhaustiveness.

### Error Handling — [error-handling.md](./error-handling.md)

Treat errors as values via `Result`. Define error types as discriminated unions so callers branch exhaustively. Do not throw exceptions in domain code.

### Boundary Defense — [boundary-defense.md](./boundary-defense.md)

Validate every external input (API requests, DB results, file/queue/env) with a schema at runtime. Trust types inside the domain. Do not use `as`. Apply `Sensitive<T>` to PII fields; the validation schema auto-wraps them.

### Declarative Style — [declarative-style.md](./declarative-style.md)

Use `filter` / `map` / `reduce` with companion-object predicates instead of imperative loops. Model domain events as immutable records.

### Test Data — [test-data.md](./test-data.md)

Define fixtures with `as const satisfies Type` to preserve discriminant literal types and prevent widening.

## Examples

Worked end-to-end examples are in [examples/](./examples/). Read them only when the topic guide cites a specific example.

## Applying These Principles

These are recommendations, not strict rules. Use judgment based on context. If you deviate from a principle, state the reason in a comment. Justifiable reasons include: external library requires class inheritance, immutable object creation cost is a measured performance concern, or a different pattern has been adopted by team agreement.
