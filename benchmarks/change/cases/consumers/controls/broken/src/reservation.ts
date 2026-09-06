import type { LegacyStorage, Reservation, ReservationEvent, Service, ServiceResponse } from "./types";
import { decodeReservation, decodeStock, isId, isQuantity, isRecord, isRevision } from "./validation";

type Command =
  | { op: "getAvailability"; sku: string }
  | { op: "getReservation"; reservationId: string }
  | { op: "reserve"; reservationId: string; sku: string; quantity: number };

function parseCommand(raw: unknown): Command | undefined {
  if (!isRecord(raw)) return undefined;
  switch (raw.op) {
    case "getAvailability":
      return isId(raw.sku) ? { op: raw.op, sku: raw.sku } : undefined;
    case "getReservation":
      return isId(raw.reservationId)
        ? { op: raw.op, reservationId: raw.reservationId } : undefined;
    case "reserve":
      return isId(raw.reservationId) && isId(raw.sku) && isQuantity(raw.quantity)
        ? { op: raw.op, reservationId: raw.reservationId, sku: raw.sku, quantity: raw.quantity }
        : undefined;
    default:
      return undefined;
  }
}

export function error(status: 400 | 404 | 409 | 500, code: string): ServiceResponse {
  return { status, body: { code } };
}

function reservationResponse(status: 200 | 201, reservation: Reservation): ServiceResponse {
  return {
    status,
    body: {
      reservationId: reservation.reservationId,
      sku: reservation.sku,
      quantity: reservation.quantity,
    },
  };
}

export function createReservationService({ storage }: { storage: LegacyStorage }): Service {
  return {
    async handle(raw) {
      const command = parseCommand(raw);
      if (command === undefined) return error(400, "invalid_command");
      try {
        if (command.op === "getAvailability") {
          const rawStock = await storage.getStock(command.sku);
          if (rawStock === undefined) return error(404, "stock_not_found");
          const stock = decodeStock(rawStock);
          if (!stock || stock.sku !== command.sku) return error(500, "storage_unavailable");
          return {
            status: 200,
            body: {
              sku: stock.sku,
              totalUnits: stock.totalUnits,
              reservedUnits: stock.reservedUnits,
              availableUnits: stock.totalUnits - stock.reservedUnits,
            },
          };
        }

        const rawReservation = await storage.getReservation(command.reservationId);
        const existing = rawReservation === undefined ? undefined : decodeReservation(rawReservation);
        if (rawReservation !== undefined && (!existing || existing.reservationId !== command.reservationId)) {
          return error(500, "storage_unavailable");
        }
        if (command.op === "getReservation") {
          return existing ? reservationResponse(200, existing) : error(404, "reservation_not_found");
        }
        if (existing) {
          return existing.sku === command.sku && existing.quantity === command.quantity
            ? reservationResponse(200, existing)
            : error(409, "reservation_conflict");
        }

        const rawStock = await storage.getStock(command.sku);
        if (rawStock === undefined) return error(404, "stock_not_found");
        const stock = decodeStock(rawStock);
        if (!stock || stock.sku !== command.sku) return error(500, "storage_unavailable");
        if (stock.totalUnits - stock.reservedUnits < command.quantity) {
          return error(409, "insufficient_stock");
        }
        const nextRevision = stock.revision + 1;
        if (!isRevision(nextRevision)) return error(500, "storage_unavailable");
        const reservation: Reservation = {
          reservationId: command.reservationId,
          sku: command.sku,
          quantity: command.quantity,
        };
        const event: ReservationEvent = {
          eventId: "reservation.created:" + reservation.reservationId,
          type: "reservation.created",
          reservationId: reservation.reservationId,
          sku: reservation.sku,
          quantity: reservation.quantity,
        };
        const outcome = await storage.commitReservation({
          expectedRevision: stock.revision,
          nextStock: {
            ...stock,
            reservedUnits: stock.reservedUnits + command.quantity,
            revision: nextRevision,
          },
          reservation,
          events: [],
        });
        if (outcome === "revision_conflict") return error(409, "commit_conflict");
        if (outcome !== "committed") return error(500, "storage_unavailable");
        return reservationResponse(201, reservation);
      } catch {
        return error(500, "storage_unavailable");
      }
    },
  };
}
