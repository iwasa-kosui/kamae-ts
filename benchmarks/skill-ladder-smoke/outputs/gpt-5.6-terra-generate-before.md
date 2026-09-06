```ts
import { z } from "zod";

export const CreateTaskInputSchema = z.object({
  title: z.string().trim().min(1),
  priority: z.enum(["Normal", "Urgent"]).default("Normal"),
});

export type CreateTaskInput = Readonly<z.output<typeof CreateTaskInputSchema>>;

export const parseCreateTaskInput = (raw: unknown) =>
  CreateTaskInputSchema.safeParse(raw);

export const createTask = (input: CreateTaskInput) =>
  ({
    kind: "Task",
    title: input.title,
    priority: input.priority,
  }) as const;
```