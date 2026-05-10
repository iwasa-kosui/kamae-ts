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
  isActive: (task: Task): task is ActiveTask => task.kind === "Active",
} as const;

// Declarative: intent is immediately clear
const activeTasks = tasks.filter(Task.isActive);

// Imperative: you have to read the loop body to understand what it does
const activeTasks: ActiveTask[] = [];
for (const task of tasks) {
  if (task.kind === "Active") activeTasks.push(task);
}
```

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
