import * as z from "zod";
import { schemaResult } from "../result";

const ExpenseIdBrand: unique symbol = Symbol();
const EmployeeIdBrand: unique symbol = Symbol();
const EmailBrand: unique symbol = Symbol();
const DescriptionBrand: unique symbol = Symbol();
const RejectionReasonBrand: unique symbol = Symbol();
const AmountCentsBrand: unique symbol = Symbol();

export type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

export const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
  }),
} as const;

const nonemptyString = z.string().min(1);
const nonblankString = z.string().refine((value) => value.trim().length > 0);

const ExpenseIdSchema = nonemptyString.brand<typeof ExpenseIdBrand>();
export type ExpenseId = z.infer<typeof ExpenseIdSchema>;
export const ExpenseId = {
  schema: ExpenseIdSchema,
  parse: schemaResult(ExpenseIdSchema),
} as const;

const EmployeeIdSchema = nonemptyString.brand<typeof EmployeeIdBrand>();
export type EmployeeId = z.infer<typeof EmployeeIdSchema>;
export const EmployeeId = {
  schema: EmployeeIdSchema,
  parse: schemaResult(EmployeeIdSchema),
} as const;

const EmailSchema = z.string().email().brand<typeof EmailBrand>();
export type Email = z.infer<typeof EmailSchema>;
export const Email = {
  schema: EmailSchema,
  parse: schemaResult(EmailSchema),
} as const;

const OwnerEmailSchema = EmailSchema.transform(Sensitive.of);
export type OwnerEmail = z.infer<typeof OwnerEmailSchema>;
export const OwnerEmail = {
  schema: OwnerEmailSchema,
  parse: schemaResult(OwnerEmailSchema),
} as const;

const DescriptionSchema = nonblankString.brand<typeof DescriptionBrand>();
export type Description = z.infer<typeof DescriptionSchema>;
export const Description = {
  schema: DescriptionSchema,
  parse: schemaResult(DescriptionSchema),
} as const;

const RejectionReasonSchema = nonblankString.brand<typeof RejectionReasonBrand>();
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;
export const RejectionReason = {
  schema: RejectionReasonSchema,
  parse: schemaResult(RejectionReasonSchema),
} as const;

const AmountCentsSchema = z
  .number()
  .int()
  .min(1)
  .max(1_000_000)
  .brand<typeof AmountCentsBrand>();
export type AmountCents = z.infer<typeof AmountCentsSchema>;
export const AmountCents = {
  schema: AmountCentsSchema,
  parse: schemaResult(AmountCentsSchema),
} as const;
