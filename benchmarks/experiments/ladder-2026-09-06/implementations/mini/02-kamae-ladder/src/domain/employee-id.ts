export const EmployeeIdBrand = Symbol("EmployeeId");

export type EmployeeId = string & {
  readonly [EmployeeIdBrand]: never;
};

const isNonemptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const toEmployeeId = (value: string): EmployeeId => value as EmployeeId;

export const EmployeeId = {
  parse: (raw: unknown): EmployeeId | undefined =>
    isNonemptyString(raw) ? toEmployeeId(raw) : undefined,
} as const;
