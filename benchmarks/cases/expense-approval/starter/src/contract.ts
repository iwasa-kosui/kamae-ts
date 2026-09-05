// This adapter deliberately leaves the internal domain model unconstrained.
export type Dependencies = Readonly<{
  repository: Readonly<{
    get: (id: string) => Promise<unknown>;
    save: (id: string, record: unknown) => Promise<void>;
  }>;
  payment: Readonly<{
    charge: (input: Readonly<{
      expenseId: string;
      amountCents: number;
      email: string;
      idempotencyKey: string;
    }>) => Promise<unknown>;
  }>;
  logger: Readonly<{ info: (event: unknown) => void }>;
}>;

export type ExpenseService = Readonly<{
  handle: (command: unknown) => Promise<Readonly<{
    status: number;
    body: unknown;
  }>>;
}>;
