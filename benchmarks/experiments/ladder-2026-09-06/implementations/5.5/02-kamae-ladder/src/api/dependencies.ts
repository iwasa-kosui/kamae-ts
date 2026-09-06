export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;

export type Repository = Readonly<{
  get: (id: string) => Promise<JsonValue | undefined>;
  save: (id: string, value: JsonValue) => Promise<void>;
}>;

export type PaymentResult =
  | Readonly<{ kind: "paid"; receiptId: string }>
  | Readonly<{ kind: "declined" }>;

export type PaymentGateway = Readonly<{
  charge: (request: Readonly<{
    expenseId: string;
    amountCents: number;
    email: string;
    idempotencyKey: string;
  }>) => Promise<PaymentResult>;
}>;

export type Logger = Readonly<{
  info: (event: Readonly<{ expenseId: string; action: string }>) => void;
}>;

export type ExpenseServiceDependencies = Readonly<{
  repository: Repository;
  payment: PaymentGateway;
  logger: Logger;
}>;
