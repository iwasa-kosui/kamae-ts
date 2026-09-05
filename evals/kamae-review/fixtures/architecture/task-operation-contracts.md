# Task service contracts

The package uses zod and neverthrow. Domain types, their branded identifiers,
and boundary validation already exist and are out of scope. No project
override is configured. Each following block is the complete named file.

`src/domain/task/task-event-store.ts`:

```typescript
import type { TaskEvent } from "./task-event";
import type { TaskId } from "./task-id";

export type TaskEventStore = Readonly<{
  append: (events: readonly TaskEvent[]) => Promise<void>;
  loadHistory: (taskId: TaskId) => Promise<readonly TaskEvent[]>;
}>;
```

`src/domain/task/task-resolver.ts`:

```typescript
import type { Task } from "./task";
import type { TaskId } from "./task-id";
import type { UserId } from "../user/user-id";

export type TaskResolver = Readonly<{
  findById: (id: TaskId) => Promise<Task | undefined>;
  findByAssignee: (assigneeId: UserId) => Promise<readonly Task[]>;
}>;
```

`src/domain/task/task-state-store.ts`:

```typescript
import type { CompletedTask } from "./completed-task";
import type { ArchivedTask } from "./archived-task";

export type TaskStateStore = Readonly<{
  saveCompleted: (task: CompletedTask) => Promise<void>;
  saveArchived: (task: ArchivedTask) => Promise<void>;
}>;
```

`src/application/record-task-events.ts` receives `TaskEventStore` and only calls
`append` with validated events supplied by its caller.
`src/application/list-assigned-tasks.ts` receives `TaskResolver` and only calls
`findByAssignee`. A separate detail view only calls `findById`.
`src/application/archive-task.ts` receives `TaskStateStore` and only calls
`saveArchived`. A separate completion workflow only calls `saveCompleted`.
All contracts live beside their domain concepts. Infrastructure adapters
implement these contracts and share a database client; the composition root
wires each consumer. None of the domain contracts imports infrastructure.
