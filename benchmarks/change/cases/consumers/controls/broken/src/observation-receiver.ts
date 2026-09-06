import type { Service } from "./types";
import { error } from "./reservation";
import { isId, isRecord, isUnits } from "./validation";

export type ObservationEvent = {
  type: "inventory.observed";
  observationId: string;
  sku: string;
  observedUnits: number;
};

export type ObservationSink = {
  appendObservation(event: ObservationEvent): Promise<unknown>;
};

export function createObservationReceiver({ sink }: { sink: ObservationSink }): Service {
  return {
    async handle(raw) {
      if (!isRecord(raw) || raw.op !== "recordObservation" ||
          !isId(raw.observationId) || !isId(raw.sku) || !isUnits(raw.observedUnits)) {
        return error(400, "invalid_command");
      }
      const event: ObservationEvent = {
        type: "inventory.observed",
        observationId: raw.observationId,
        sku: raw.sku,
        observedUnits: raw.observedUnits,
      };
      try {
        const outcome = await sink.appendObservation(event);
        if (outcome === "stored") {
          return { status: 201, body: { observationId: event.observationId, recorded: true } };
        }
        if (outcome === "duplicate") {
          return { status: 200, body: { observationId: event.observationId, recorded: false } };
        }
        return error(500, "storage_unavailable");
      } catch {
        return error(500, "storage_unavailable");
      }
    },
  };
}
