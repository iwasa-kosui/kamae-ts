import { z } from "zod";

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["Normal", "Urgent"]),
});
