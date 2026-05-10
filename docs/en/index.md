---
title: English
description: A reading version of the kamae-ts principles for designing and implementing robust server-side TypeScript applications
nav_order: 2
has_children: true
permalink: /en/
---

# kamae-ts — Functional Domain Modeling

A reading version of the principles to follow when modeling domains in server-side TypeScript. Instead of class-based OOP, we lean on the TypeScript type system and a functional approach.

This is a human-oriented reorganization of the knowledge base used by the coding-agent skills shipped in the [kamae-ts plugin](https://github.com/iwasa-kosui/kamae-ts).

## 1. Type-Driven Domain Modeling

Express domain state with Discriminated Unions and use `kind` as the unifying discriminant. Prefer `type` over `interface`, the Companion Object pattern, Branded Types, `Readonly<>`, function-property notation, and a one-concept-per-file layout.

→ [domain-modeling.md](./domain-modeling.md)

## 2. State Transitions via Pure Functions

Express state transitions with pure functions: argument types constrain valid source states, return types declare the target state, and invalid transitions become compile errors. Use `assertNever` to enforce exhaustiveness.

→ [state-modeling.md](./state-modeling.md)

## 3. Error Handling — Railway Oriented Programming

Do not throw exceptions; treat errors as values via Result types. Define error types as Discriminated Unions so callers can handle them exhaustively.

Library guides: [neverthrow](./result-libraries/neverthrow.md) / [byethrow](./result-libraries/byethrow.md) / [fp-ts](./result-libraries/fp-ts.md) / [option-t](./result-libraries/option-t.md)

→ [error-handling.md](./error-handling.md)

## 4. Boundary Defense

Validate external inputs (API requests, DB results, file reads) at runtime with a validation-library schema. Trust types inside the domain layer. Do not use type assertions (`as`). Wrap PII fields in a `Sensitive<T>` wrapper.

Library guides: [zod](./validation-libraries/zod.md) / [valibot](./validation-libraries/valibot.md) / [arktype](./validation-libraries/arktype.md)

→ [boundary-defense.md](./boundary-defense.md)

## 5. Declarative Style

Transform arrays declaratively with `filter` / `map` / `reduce`, using predicate functions defined on the Companion Object. Model domain events as immutable records.

→ [declarative-style.md](./declarative-style.md)

## 6. Test Data

Define test data with `as const satisfies Type` to preserve discriminant literal types and prevent widening.

→ [test-data.md](./test-data.md)

## Code Review

For an adversarial code-review guide grounded in these principles, see [code-review.md](./code-review.md).

## Applying the Principles

These are recommendations, not strict rules. Use judgment based on context, but when you depart from a principle, document the reason in a comment.

Typical justified deviations:

- An external library requires class inheritance.
- Performance requirements make immutable-data construction costs problematic.
- A team has agreed on a different pattern.
