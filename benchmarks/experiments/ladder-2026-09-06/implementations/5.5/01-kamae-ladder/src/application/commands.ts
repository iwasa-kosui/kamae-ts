import * as z from "zod";
import { schemaResult } from "../result";
import {
  AmountCents,
  Description,
  EmployeeId,
  ExpenseId,
  OwnerEmail,
  RejectionReason,
} from "../domain/value-objects";

const CreateCommandSchema = z.object({
  op: z.literal("create"),
  id: ExpenseId.schema,
  ownerId: EmployeeId.schema,
  ownerEmail: OwnerEmail.schema,
  description: Description.schema,
  amountCents: AmountCents.schema,
});

const SubmitCommandSchema = z.object({
  op: z.literal("submit"),
  id: ExpenseId.schema,
  actorId: EmployeeId.schema,
});

const ApproveCommandSchema = z.object({
  op: z.literal("approve"),
  id: ExpenseId.schema,
  actorId: EmployeeId.schema,
});

const RejectCommandSchema = z.object({
  op: z.literal("reject"),
  id: ExpenseId.schema,
  actorId: EmployeeId.schema,
  reason: RejectionReason.schema,
});

const PayCommandSchema = z.object({
  op: z.literal("pay"),
  id: ExpenseId.schema,
});

const GetCommandSchema = z.object({
  op: z.literal("get"),
  id: ExpenseId.schema,
});

const CommandSchema = z.discriminatedUnion("op", [
  CreateCommandSchema,
  SubmitCommandSchema,
  ApproveCommandSchema,
  RejectCommandSchema,
  PayCommandSchema,
  GetCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;

export const Command = {
  schema: CommandSchema,
  parse: schemaResult(CommandSchema),
} as const;
