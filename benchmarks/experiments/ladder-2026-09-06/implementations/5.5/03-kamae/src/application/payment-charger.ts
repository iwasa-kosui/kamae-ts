import type { AmountCents } from "../domain/expense/amount-cents";
import type { EmailAddress } from "../domain/expense/email-address";
import type { ExpenseId } from "../domain/expense/expense-id";
import type { ReceiptId } from "../domain/expense/receipt-id";

export type PaymentCharge = Readonly<{
  expenseId: ExpenseId;
  amountCents: AmountCents;
  email: EmailAddress;
  idempotencyKey: ExpenseId;
}>;

export type PaymentResult =
  | Readonly<{ kind: "paid"; receiptId: ReceiptId }>
  | Readonly<{ kind: "declined" }>;

export type PaymentCharger = Readonly<{
  charge: (charge: PaymentCharge) => Promise<PaymentResult>;
}>;

