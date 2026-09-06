import * as z from "zod";
import { AmountCents } from "../domain/expense/amount-cents";
import { Description } from "../domain/expense/description";
import { EmailAddress } from "../domain/expense/email-address";
import { EmployeeId } from "../domain/expense/employee-id";
import { ExpenseId } from "../domain/expense/expense-id";
import { RejectionReason } from "../domain/expense/rejection-reason";
import { schemaResult } from "../domain/expense/validation";

const CommandSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    id: ExpenseId.schema,
    ownerId: EmployeeId.schema,
    ownerEmail: EmailAddress.sensitiveSchema,
    description: Description.schema,
    amountCents: AmountCents.schema,
  }),
  z.object({
    op: z.literal("submit"),
    id: ExpenseId.schema,
    actorId: EmployeeId.schema,
  }),
  z.object({
    op: z.literal("approve"),
    id: ExpenseId.schema,
    actorId: EmployeeId.schema,
  }),
  z.object({
    op: z.literal("reject"),
    id: ExpenseId.schema,
    actorId: EmployeeId.schema,
    reason: RejectionReason.schema,
  }),
  z.object({
    op: z.literal("pay"),
    id: ExpenseId.schema,
  }),
  z.object({
    op: z.literal("get"),
    id: ExpenseId.schema,
  }),
]);

export type Command = z.infer<typeof CommandSchema>;

export const Command = {
  parse: schemaResult(CommandSchema),
} as const;

