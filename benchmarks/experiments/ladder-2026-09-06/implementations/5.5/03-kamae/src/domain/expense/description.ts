import * as z from "zod";
import { schemaResult } from "./validation";

export const DescriptionBrand = Symbol();

const DescriptionSchema = z
  .string()
  .refine((value) => value.trim().length > 0)
  .brand<typeof DescriptionBrand>();

export type Description = z.infer<typeof DescriptionSchema>;

export const Description = {
  schema: DescriptionSchema,
  parse: schemaResult(DescriptionSchema),
} as const;

