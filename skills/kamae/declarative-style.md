# Declarative Style Detailed Guide

## Array Operations

Write array transformations declaratively using `filter` / `map` / `reduce`. Define predicate functions in the Companion Object.

```typescript
type Task = ActiveTask | CompletedTask;

const Task = {
  isActive: (task: Task) => task.kind === "Active",
} as const;

// Declarative: intent is clear
const activeTasks = tasks.filter(Task.isActive);

// Imperative: you have to read the loop body to understand the intent
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

Generate domain events that accompany state changes as immutable records, and record them separately from the repository.

```typescript
type DomainEvent = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: string;
  payload: unknown;
  aggregateId: string;
}>;
```

For detailed design of domain events (event generation responsibility, use case integration), see [state-modeling.md](./state-modeling.md).
