import * as z from "zod";
import { Sensitive } from "./sensitive";
import { schemaResult } from "./validation";

export const EmailAddressBrand = Symbol();

const EmailAddressSchema = z
  .string()
  .email()
  .brand<typeof EmailAddressBrand>();

const SensitiveEmailAddressSchema = EmailAddressSchema.transform(Sensitive.of);

export type EmailAddress = z.infer<typeof EmailAddressSchema>;
export type SensitiveEmailAddress = z.infer<typeof SensitiveEmailAddressSchema>;

export const EmailAddress = {
  schema: EmailAddressSchema,
  sensitiveSchema: SensitiveEmailAddressSchema,
  parse: schemaResult(EmailAddressSchema),
  parseSensitive: schemaResult(SensitiveEmailAddressSchema),
} as const;

