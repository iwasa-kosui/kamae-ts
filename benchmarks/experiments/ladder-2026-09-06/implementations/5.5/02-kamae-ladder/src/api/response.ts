import type { ExpenseView } from "../domain/expense";

export type SuccessStatus = 200 | 201;
export type ErrorStatus = 400 | 403 | 404 | 409 | 422 | 500;
export type HandleResponse =
  | Readonly<{ status: SuccessStatus; body: ExpenseView }>
  | Readonly<{ status: ErrorStatus; body: Readonly<{ code: string }> }>;

export const Response = {
  success: (status: SuccessStatus, body: ExpenseView): HandleResponse => ({ status, body }),
  error: (status: ErrorStatus, code: string): HandleResponse => ({ status, body: { code } }),
} as const;
