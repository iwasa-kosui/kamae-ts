import type { LegacyStorage, Service } from "./types";
import { createReservationService } from "./reservation";
import { decodeReservation, decodeStock, isRecord, isRevision } from "./validation";

export type ProviderBStockRow = {
  itemKey: string;
  onHandText: string;
  heldText: string;
  revisionText: string;
};

export type ProviderBReservationRow = {
  bookingKey: string;
  itemKey: string;
  unitsText: string;
};

export type ProviderBOutboxRow = {
  key: string;
  category: "reservation";
  name: "created";
  payload: { bookingKey: string; itemKey: string; unitsText: string };
};

export type ProviderBBatch = {
  expectedRevisionText: string;
  stockRow: ProviderBStockRow;
  reservationRow: ProviderBReservationRow;
  outboxRows: ProviderBOutboxRow[];
};

export type ProviderBStorage = {
  read(request: { collection: "inventory" | "reservations"; key: string }): Promise<unknown>;
  commitBatch(batch: ProviderBBatch): Promise<unknown>;
};

function unavailable(): never {
  throw new Error("storage_unavailable");
}

function decimal(raw: unknown): number | undefined {
  if (typeof raw !== "string" || !/^(0|[1-9][0-9]*)$/.test(raw)) return undefined;
  const value = Number(raw);
  return isRevision(value) ? value : undefined;
}

function unwrapLookup(raw: unknown): unknown {
  if (!isRecord(raw)) return unavailable();
  if (raw.ok === true && raw.value !== undefined) return raw.value;
  if (raw.ok === false && isRecord(raw.error) && raw.error.reason === "NO_SUCH_KEY") {
    return undefined;
  }
  return unavailable();
}

function adaptStorage(storage: ProviderBStorage): LegacyStorage {
  return {
    async getStock(sku) {
      const row = unwrapLookup(await storage.read({ collection: "inventory", key: sku }));
      if (row === undefined) return undefined;
      if (!isRecord(row) || row.itemKey !== sku) return unavailable();
      const stock = decodeStock({
        sku: row.itemKey,
        totalUnits: decimal(row.onHandText),
        reservedUnits: decimal(row.heldText),
        revision: decimal(row.revisionText),
      });
      return stock ?? unavailable();
    },
    async getReservation(reservationId) {
      const row = unwrapLookup(await storage.read({ collection: "reservations", key: reservationId }));
      if (row === undefined) return undefined;
      if (!isRecord(row) || row.bookingKey !== reservationId) return unavailable();
      const reservation = decodeReservation({
        reservationId: row.bookingKey,
        sku: row.itemKey,
        quantity: decimal(row.unitsText),
      });
      return reservation ?? unavailable();
    },
    async commitReservation(change) {
      const outcome = await storage.commitBatch({
        expectedRevisionText: String(change.expectedRevision),
        stockRow: {
          itemKey: change.nextStock.sku,
          onHandText: String(change.nextStock.totalUnits),
          heldText: String(change.nextStock.reservedUnits),
          revisionText: String(change.nextStock.revision),
        },
        reservationRow: {
          bookingKey: change.reservation.reservationId,
          itemKey: change.reservation.sku,
          unitsText: String(change.reservation.quantity),
        },
        outboxRows: change.events.map((event): ProviderBOutboxRow => ({
          key: event.eventId,
          category: "reservation",
          name: "created",
          payload: {
            bookingKey: event.reservationId,
            itemKey: event.sku,
            unitsText: String(event.quantity),
          },
        })),
      });
      if (outcome === "applied") return "committed";
      if (outcome === "revision_conflict") return "revision_conflict";
      return unavailable();
    },
  };
}

export function createProviderBReservationService(
  { storage }: { storage: ProviderBStorage },
): Service {
  return createReservationService({ storage: adaptStorage(storage) });
}
