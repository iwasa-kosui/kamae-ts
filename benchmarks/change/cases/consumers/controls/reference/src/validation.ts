import type { Reservation, Stock } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isUnits(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) &&
    value >= 0 && value <= 1_000_000;
}

export function isQuantity(value: unknown): value is number {
  return isUnits(value) && value > 0;
}

export function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function decodeStock(value: unknown): Stock | undefined {
  if (!isRecord(value) || !isId(value.sku) || !isUnits(value.totalUnits) ||
      !isUnits(value.reservedUnits) || value.reservedUnits > value.totalUnits ||
      !isRevision(value.revision)) return undefined;
  return {
    sku: value.sku,
    totalUnits: value.totalUnits,
    reservedUnits: value.reservedUnits,
    revision: value.revision,
  };
}

export function decodeReservation(value: unknown): Reservation | undefined {
  if (!isRecord(value) || !isId(value.reservationId) ||
      !isId(value.sku) || !isQuantity(value.quantity)) return undefined;
  return {
    reservationId: value.reservationId,
    sku: value.sku,
    quantity: value.quantity,
  };
}
