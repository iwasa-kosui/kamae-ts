---
title: Declarative Style
parent: English
nav_order: 5
---

# Declarative Style — Detailed Guide

## Array Operations

Transform arrays declaratively with `filter` / `map` / `reduce`. Define predicate functions on the Companion Object.

```typescript
type Task = ActiveTask | CompletedTask;

const Task = {
  isActive: (task: Task) => task.kind === "Active",
} as const;

// Declarative: intent is immediately clear
const activeTasks = tasks.filter(Task.isActive);

// Imperative: you have to read the loop body to understand what it does
const activeTasks: ActiveTask[] = [];
for (const task of tasks) {
  if (task.kind === "Active") activeTasks.push(task);
}
```

### Don't write redundant `x is Y` annotations

Predicate functions over a discriminated union don't need an explicit `: x is Y` return-type annotation. TypeScript 5.5+ infers the type predicate from any body that narrows on `kind`, and `Array.prototype.filter` consumes the inferred predicate. Writing the annotation falsely implies that discriminated union narrowing alone is insufficient.

```typescript
// ❌ Redundant — the inferred predicate already exists
isActive: (task: Task): task is ActiveTask => task.kind === "Active",

// ✅ Let the compiler infer
isActive: (task: Task) => task.kind === "Active",
```

The same applies to multi-state predicates: bodies built from `||` chains over `kind` or their `!== … && !== …` negation are all inferred correctly by TS 5.5+.

## Domain Events

Produce domain events that accompany state changes as immutable records, separate from the repository.

```typescript
type DomainEvent = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: string;
  payload: unknown;
  aggregateId: string;
}>;
```

For the detailed design of domain events — including who is responsible for constructing them and how they integrate with use cases — see [state-modeling.md](./state-modeling.md).
