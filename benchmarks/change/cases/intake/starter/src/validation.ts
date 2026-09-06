import { z } from "zod";
import type { OrderInput } from "./types";

function matchesEntire(pattern: RegExp, value: string): boolean {
  return pattern.exec(value)?.[0] === value;
}

const identifier = z.string().refine((value) =>
  matchesEntire(/^[A-Za-z0-9_-]{1,64}$/, value),
);

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 2000 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isCanonicalDate(value: string): boolean {
  if (!matchesEntire(/^20\d{2}-\d{2}-\d{2}$/, value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return isCalendarDate(year, month, day);
}

const versionOne = z.object({
  formatVersion: z.literal(1).optional(),
  id: identifier,
  customerId: identifier,
  amountCents: z.number().int().min(1).max(1_000_000),
  shipOn: z.string().refine(isCanonicalDate),
});

export function isOrderId(value: unknown): value is string {
  return identifier.safeParse(value).success;
}

export function parseOrder(value: unknown): OrderInput | undefined {
  const parsed = versionOne.safeParse(value);
  if (!parsed.success) return undefined;
  return {
    id: parsed.data.id,
    customerId: parsed.data.customerId,
    amountCents: parsed.data.amountCents,
    shipOn: parsed.data.shipOn,
  };
}
