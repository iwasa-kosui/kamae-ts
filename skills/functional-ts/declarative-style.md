# Declarative Style Detailed Guide

## Array Operations

Write array transformations declaratively using `filter` / `map` / `reduce`. Define predicate functions in the Companion Object.

```typescript
type Task = ActiveTask | CompletedTask;

const Task = {
  isActive: (task: Task): task is ActiveTask => task.kind === "Active",
} as const;

// Declarative: intent is clear
const activeTasks = tasks.filter(Task.isActive);

// Imperative: you have to read the loop body to understand the intent
const activeTasks: ActiveTask[] = [];
for (const task of tasks) {
  if (task.kind === "Active") activeTasks.push(task);
}
```

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
