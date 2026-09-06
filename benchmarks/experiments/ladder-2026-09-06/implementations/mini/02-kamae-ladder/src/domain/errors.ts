export type ErrorResponse = Readonly<{
  status: 400 | 403 | 404 | 409 | 422 | 500;
  body: Readonly<{
    code: string;
  }>;
}>;

export const ErrorResponse = {
  invalidCommand: (): ErrorResponse => ({ status: 400, body: { code: "invalid_command" } }),
  forbidden: (): ErrorResponse => ({ status: 403, body: { code: "forbidden" } }),
  missing: (): ErrorResponse => ({ status: 404, body: { code: "missing" } }),
  conflict: (code = "conflict"): ErrorResponse => ({ status: 409, body: { code } }),
  paymentDeclined: (): ErrorResponse => ({
    status: 422,
    body: { code: "payment_declined" },
  }),
  unavailable: (code = "unavailable"): ErrorResponse => ({
    status: 500,
    body: { code },
  }),
} as const;
