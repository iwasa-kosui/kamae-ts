# Declarative Style and Test Data Checklist

Reference: [`../../kamae/SKILL.md` §5–§6](../../kamae/SKILL.md), [`../../kamae/declarative-style.md`](../../kamae/declarative-style.md), [`../../kamae/test-data.md`](../../kamae/test-data.md).

## 5.1 Are array operations declarative? — Low

Flag: `for` / `for…of` loops that build up arrays imperatively when `filter` / `map` / `reduce` would express the intent directly. Suggest defining predicates on the companion object (e.g., `tasks.filter(Task.isActive)`).

## 5.2 Are domain events emitted as immutable records? — Low

Flag: state-change code that mutates a shared event log, or that omits domain events entirely when the state-modeling guidance calls for them. Events should be `Readonly<{ eventId; eventAt; eventName; payload; aggregateId }>` and recorded separately from the repository.

## 5.3 Are companion-object predicates free of redundant `x is Y` annotations? — Low

Flag: predicate functions over a discriminated union that carry an explicit `: x is Y` return-type annotation when the body is just `kind === "..."` comparisons (or their `!==` negation). TypeScript 5.5+ infers the type predicate from such bodies and `Array.prototype.filter` consumes the inferred predicate, so the annotation adds nothing — and falsely implies that discriminated union narrowing alone is insufficient. Suggest dropping the annotation.

## 6.1 Is `as const satisfies Type` used for fixtures? — Low

Flag: test fixtures typed with `: Type =` or with `as Type`, which widen discriminant literals to `string`. Suggest `as const satisfies Type` so `kind` keeps its literal type.
