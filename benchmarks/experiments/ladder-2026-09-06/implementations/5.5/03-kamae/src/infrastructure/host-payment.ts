import * as z from "zod";
import type {
  PaymentCharge,
  PaymentCharger,
} from "../application/payment-charger";
import { ReceiptId } from "../domain/expense/receipt-id";

const GatewayResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paid"),
    receiptId: ReceiptId.schema,
  }),
  z.object({
    kind: z.literal("declined"),
  }),
]);

export type HostPayment = Readonly<{
  charge: (charge: {
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }) => Promise<unknown>;
}>;

export const createHostPaymentCharger = (
  payment: HostPayment,
): PaymentCharger => ({
  charge: async (charge: PaymentCharge) => {
    const result = await payment.charge({
      expenseId: charge.expenseId,
      amountCents: charge.amountCents,
      email: charge.email,
      idempotencyKey: charge.idempotencyKey,
    });
    const parsed = GatewayResponseSchema.safeParse(result);
    if (!parsed.success) {
      throw new Error("Unusable gateway response");
    }
    return parsed.data;
  },
});

