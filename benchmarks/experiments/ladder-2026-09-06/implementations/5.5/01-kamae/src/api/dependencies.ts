export type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type HostRepository = Readonly<{
  get: (id: string) => Promise<unknown | undefined>;
  save: (id: string, value: JsonValue) => Promise<void>;
}>;

export type HostPayment = Readonly<{
  charge: (request: {
    readonly expenseId: string;
    readonly amountCents: number;
    readonly email: string;
    readonly idempotencyKey: string;
  }) => Promise<unknown>;
}>;

export type HostLogger = Readonly<{
  info: (event: unknown) => void;
}>;

export type ExpenseServiceDependencies = Readonly<{
  repository: HostRepository;
  payment: HostPayment;
  logger: HostLogger;
}>;
