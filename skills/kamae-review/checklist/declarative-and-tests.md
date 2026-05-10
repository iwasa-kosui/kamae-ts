# Declarative Style and Test Data Checklist

Reference: [`../../kamae/SKILL.md` §5–§6](../../kamae/SKILL.md), [`../../kamae/declarative-style.md`](../../kamae/declarative-style.md), [`../../kamae/test-data.md`](../../kamae/test-data.md).

## 5.1 Are array operations declarative? — Low

Flag: `for` / `for…of` loops that build up arrays imperatively when `filter` / `map` / `reduce` would express the intent directly. Suggest defining predicates on the companion object (e.g., `tasks.filter(Task.isActive)`).

## 5.2 Are domain events emitted as immutable records? — Low

Flag: state-change code that mutates a shared event log, or that omits domain events entirely when the state-modeling guidance calls for them. Events should be `Readonly<{ eventId; eventAt; eventName; payload; aggregateId }>` and recorded separately from the repository.

## 6.1 Is `as const satisfies Type` used for fixtures? — Low

Flag: test fixtures typed with `: Type =` or with `as Type`, which widen discriminant literals to `string`. Suggest `as const satisfies Type` so `kind` keeps its literal type.
