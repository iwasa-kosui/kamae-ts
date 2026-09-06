import * as z from "zod";
import { Sensitive } from "./sensitive";

export const OwnerEmailBrand = Symbol();
const OwnerEmailRawSchema = z.email().brand<typeof OwnerEmailBrand>();
export type OwnerEmail = z.infer<typeof OwnerEmailRawSchema>;

export const OwnerEmail = {
  rawSchema: OwnerEmailRawSchema,
  schema: OwnerEmailRawSchema.transform(Sensitive.of),
} as const;
