declare const EmployeeIdBrand: unique symbol;

export type EmployeeId = string & { readonly [EmployeeIdBrand]: never };

export const EmployeeId = {
  of: (value: string): EmployeeId => value as EmployeeId,
  parse: (raw: unknown): EmployeeId | undefined =>
    typeof raw === "string" && raw.length > 0 ? EmployeeId.of(raw) : undefined,
} as const;
