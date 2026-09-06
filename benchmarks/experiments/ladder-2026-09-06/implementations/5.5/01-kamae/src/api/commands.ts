import * as z from "zod";
import { AmountCents } from "../domain/expense/amount-cents";
import { Description } from "../domain/expense/description";
import { EmployeeId } from "../domain/expense/employee-id";
import { ExpenseId } from "../domain/expense/expense-id";
import { OwnerEmail } from "../domain/expense/owner-email";
import { RejectionReason } from "../domain/expense/rejection-reason";
import { schemaResult } from "../shared/validation";

const CreateCommandSchema = z.object({
  op: z.literal("create"),
  id: ExpenseId.schema,
  ownerId: EmployeeId.schema,
  ownerEmail: OwnerEmail.schema,
  description: Description.schema,
  amountCents: AmountCents.schema,
});

const ActorCommandSchema = z.object({
  id: ExpenseId.schema,
  actorId: EmployeeId.schema,
});

const SubmitCommandSchema = ActorCommandSchema.extend({
  op: z.literal("submit"),
});

const ApproveCommandSchema = ActorCommandSchema.extend({
  op: z.literal("approve"),
});

const RejectCommandSchema = ActorCommandSchema.extend({
  op: z.literal("reject"),
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

export const Command = {
  schema: z.discriminatedUnion("op", [
    CreateCommandSchema,
    SubmitCommandSchema,
    ApproveCommandSchema,
    RejectCommandSchema,
    PayCommandSchema,
    GetCommandSchema,
  ]),
  parse: schemaResult(
    z.discriminatedUnion("op", [
      CreateCommandSchema,
      SubmitCommandSchema,
      ApproveCommandSchema,
      RejectCommandSchema,
      PayCommandSchema,
      GetCommandSchema,
    ]),
  ),
} as const;

export type Command = z.infer<typeof Command.schema>;
export type CreateCommand = z.infer<typeof CreateCommandSchema>;
export type SubmitCommand = z.infer<typeof SubmitCommandSchema>;
export type ApproveCommand = z.infer<typeof ApproveCommandSchema>;
export type RejectCommand = z.infer<typeof RejectCommandSchema>;
export type PayCommand = z.infer<typeof PayCommandSchema>;
export type GetCommand = z.infer<typeof GetCommandSchema>;
