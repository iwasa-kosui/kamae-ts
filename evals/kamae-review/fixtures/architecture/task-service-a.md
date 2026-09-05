# Task service module snapshot

The package uses Zod and neverthrow. No project-specific architecture override
is configured. Domain models and boundary validation are already reviewed;
this snapshot shows dependency declarations and module ownership only.

```text
src/domain/task/task.ts
src/domain/task/task-id.ts
src/ports/task-repository.ts
src/application/complete-task.ts
src/infrastructure/postgres-task-repository.ts
src/main.ts
```

`src/ports/task-repository.ts` (lines 1–7):

```typescript
import type { Task } from "../domain/task/task";
import type { TaskId } from "../domain/task/task-id";

export type TaskRepository = Readonly<{
  findById: (id: TaskId) => Promise<Task | undefined>;
  save: (task: Task) => Promise<void>;
}>;
```

`src/application/complete-task.ts` imports `TaskRepository` from
`../ports/task-repository` and receives it as an injected dependency.
`src/infrastructure/postgres-task-repository.ts` imports the same type and
implements it with a Postgres client, parsing query results into domain types.
`src/main.ts` constructs the adapter and injects it into the use case.
The domain models do not import application, ports, or infrastructure modules.
