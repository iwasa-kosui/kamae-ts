// Grader-only types. Never supplied to the model.
export type Dependencies = {
  repository: { get(id: string): Promise<unknown>; save(id: string, value: unknown): Promise<void> };
  payment: { charge(input: { expenseId: string; amountCents: number; email: string; idempotencyKey: string }): Promise<unknown> };
  logger: { info(event: unknown): void };
};
