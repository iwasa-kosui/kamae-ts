import type { Service } from "./types";
import { error } from "./reservation";
import { isId, isRecord, isUnits } from "./validation";

export type StockReportSource = {
  readSnapshot(): Promise<unknown>;
};

export function createStockReport({ source }: { source: StockReportSource }): Service {
  return {
    async handle(raw) {
      if (!isRecord(raw) || raw.op !== "lowStock" || !isUnits(raw.belowUnits)) {
        return error(400, "invalid_command");
      }
      try {
        const snapshot = await source.readSnapshot();
        if (!Array.isArray(snapshot)) return error(500, "storage_unavailable");
        const items: { sku: string; availableUnits: number }[] = [];
        const seen = new Set<string>();
        for (const row of snapshot) {
          if (!isRecord(row) || !isId(row.sku) || !isUnits(row.totalUnits) ||
              !isUnits(row.reservedUnits) || row.reservedUnits > row.totalUnits ||
              seen.has(row.sku)) return error(500, "storage_unavailable");
          seen.add(row.sku);
          const availableUnits = row.totalUnits - row.reservedUnits;
          if (availableUnits < raw.belowUnits) items.push({ sku: row.sku, availableUnits });
        }
        items.sort((a, b) => a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0);
        return { status: 200, body: { items } };
      } catch {
        return error(500, "storage_unavailable");
      }
    },
  };
}
