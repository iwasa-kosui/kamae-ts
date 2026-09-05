# Task service contracts

The package uses zod and neverthrow. Domain types, their branded identifiers,
and boundary validation already exist and are out of scope. No project
override is configured. Each following block is the complete named file.

`src/domain/task/task-by-id-resolver.ts`:

```typescript
import type { Task } from "./task";
import type { TaskId } from "./task-id";

export type TaskByIdResolver = Readonly<{
  findById: (id: TaskId) => Promise<Task | undefined>;
}>;
```

`src/domain/task/tasks-by-assignee-resolver.ts`:

```typescript
import type { Task } from "./task";
import type { UserId } from "../user/user-id";

export type TasksByAssigneeResolver = Readonly<{
  resolve: (assigneeId: UserId) => Promise<readonly Task[]>;
}>;
```

`src/domain/task/task-completion-store.ts`:

```typescript
import type { CompletedTask } from "./completed-task";
import type { TaskCompletedEvent } from "./task-completed-event";

export type TaskCompletionStore = Readonly<{
  save: (state: CompletedTask, events: readonly TaskCompletedEvent[]) => Promise<void>;
}>;
```

`src/domain/task/task-event-repository.ts`:

```typescript
import type { TaskEvent } from "./task-event";

export type TaskEventRepository = Readonly<{
  append: (events: readonly TaskEvent[]) => Promise<void>;
}>;
```

`completeTask` receives `TaskByIdResolver` and `TaskCompletionStore` separately.
It resolves input, calls a pure completion function with the resolved task and
caller-supplied time and event ID, then saves the returned state and events.
The store adapter writes state and outbox rows in one database transaction.
`listAssignedTasks` receives only `TasksByAssigneeResolver`.
`recordTaskEvents` receives only `TaskEventRepository` and appends caller-supplied
validated events. Its name is established locally; it has no other operation.
The adapters share a database client. The composition root wires each consumer
with only its needed contracts. Domain contracts import only domain types.
