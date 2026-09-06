import type { AmountCents } from "./amount-cents";
import type { ExpenseId } from "./expense-id";
import type { OwnerEmail } from "./owner-email";
import type { ReceiptId } from "./receipt-id";

export type PaymentRequest = Readonly<{
  expenseId: ExpenseId;
  amountCents: AmountCents;
  email: OwnerEmail;
  idempotencyKey: ExpenseId;
}>;

export type PaymentResult =
  | Readonly<{ kind: "paid"; receiptId: ReceiptId }>
  | Readonly<{ kind: "declined" }>;

export type PaymentGateway = Readonly<{
  charge: (request: PaymentRequest) => Promise<PaymentResult>;
}>;
