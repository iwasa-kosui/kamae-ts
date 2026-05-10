---
name: kamae
description: Use when writing server-side TypeScript code involving domain models, use cases, repositories, state transitions, or business logic. Guides functional domain modeling with discriminated unions, pure functions, and Result types.
license: MIT
---

# Functional Domain Modeling in TypeScript

Principles for writing domain models in server-side TypeScript. Instead of class-based OOP, this approach maximizes the TypeScript type system through a functional style.

## 1. Type-Driven Domain Modeling

Represent states with discriminated unions using `kind` as the unified discriminant. Use `type` (not `interface`), companion objects, branded types, `Readonly<>`, function property notation, and one-concept-per-file structure.

**Validation library detection:** Check `dependencies` / `devDependencies` in the project's `package.json` for branded type syntax:

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

Details: [domain-modeling.md](./domain-modeling.md)

## 2. State Transitions via Functions

Express state transitions with pure functions. The argument type constrains valid source states, and the return type makes the target state explicit. Invalid transitions become compile errors. Use `assertNever` for exhaustiveness checking.

Details: [state-modeling.md](./state-modeling.md)

## 3. Error Handling — Railway Oriented Programming

Do not throw exceptions; treat errors as values using the Result type. Define error types as discriminated unions so callers can handle them exhaustively.

**Library detection:** Check `dependencies` / `devDependencies` in the project's `package.json`:

- `neverthrow` → [result-libraries/neverthrow.md](./result-libraries/neverthrow.md)
- `byethrow` → [result-libraries/byethrow.md](./result-libraries/byethrow.md)
- `fp-ts` → [result-libraries/fp-ts.md](./result-libraries/fp-ts.md)
- `option-t` → [result-libraries/option-t.md](./result-libraries/option-t.md)

Details: [error-handling.md](./error-handling.md)

## 4. Boundary Defense

Validate external inputs (API requests, DB results, file reads) with validation library schemas at runtime. Trust types inside the domain layer. Do not use type assertions (`as`). Apply `Sensitive<T>` wrapper to PII fields.

Details: [boundary-defense.md](./boundary-defense.md)

## 5. Declarative Style

Write array transformations declaratively using `filter` / `map` / `reduce` with companion object predicates. Model domain events as immutable records.

Details: [declarative-style.md](./declarative-style.md)

## 6. Test Data

Define test data with `as const satisfies Type` to preserve discriminant literal types and prevent widening.

Details: [test-data.md](./test-data.md)

## Applying These Principles

These are recommendations, not strict rules. You may use your judgment based on context, but if you deviate from a principle, explicitly state the reason in a comment.

Typical justified reasons to deviate:
- An external library requires class inheritance
- Immutable object creation cost is a performance concern
- A different pattern has been adopted by team agreement
