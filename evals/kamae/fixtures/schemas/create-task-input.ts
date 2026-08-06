import { z } from "zod";

export type CreateTaskInput = Readonly<{
  title: string;
  priority: "Normal" | "Urgent";
}>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["Normal", "Urgent"]),
});
