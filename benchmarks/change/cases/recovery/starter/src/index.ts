export interface Recipient {
  name: string;
  postalAddress: string;
}

export interface ProviderRequest {
  shipmentId: string;
  routeCode: string;
  parcelGrams: number;
  recipient: Recipient;
  idempotencyKey: string;
}

export interface ShippingDependencies {
  repository: {
    get(shipmentId: string): Promise<unknown>;
    save(shipmentId: string, record: unknown): Promise<void>;
  };
  atlas: {
    book(request: ProviderRequest): Promise<unknown>;
  };
  logger: {
    info(event: Record<string, unknown>): void;
  };
}

interface ShipmentFields {
  schemaVersion: 1;
  id: string;
  routeCode: string;
  parcelGrams: number;
}

interface QueuedShipment extends ShipmentFields {
  state: "queued";
}

interface DispatchedShipment extends ShipmentFields {
  state: "dispatched";
  provider: "atlas";
  bookingId: string;
  dispatchedAtMs: number;
}

type StoredShipment = QueuedShipment | DispatchedShipment;
export type PublicShipment =
  | Omit<QueuedShipment, "schemaVersion">
  | Omit<DispatchedShipment, "schemaVersion">;

export interface ServiceResponse {
  status: number;
  body: PublicShipment | {
    code: "invalid_command" | "not_found" | "service_unavailable";
  };
}

type Command =
  | { op: "get"; shipmentId: string }
  | { op: "dispatch"; shipmentId: string; nowMs: number; recipient: Recipient };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCommand(value: unknown): Command | undefined {
  if (!isObject(value) || typeof value.shipmentId !== "string" || value.shipmentId.length === 0) {
    return undefined;
  }
  if (value.op === "get") {
    return { op: "get", shipmentId: value.shipmentId };
  }
  if (
    value.op !== "dispatch" ||
    typeof value.nowMs !== "number" ||
    !Number.isSafeInteger(value.nowMs) ||
    value.nowMs < 0 ||
    !isObject(value.recipient) ||
    typeof value.recipient.name !== "string" ||
    value.recipient.name.trim().length === 0 ||
    typeof value.recipient.postalAddress !== "string" ||
    value.recipient.postalAddress.trim().length === 0
  ) {
    return undefined;
  }
  return {
    op: "dispatch",
    shipmentId: value.shipmentId,
    nowMs: value.nowMs,
    recipient: {
      name: value.recipient.name,
      postalAddress: value.recipient.postalAddress,
    },
  };
}

function publicShipment(shipment: StoredShipment): PublicShipment {
  const fields = {
    id: shipment.id,
    routeCode: shipment.routeCode,
    parcelGrams: shipment.parcelGrams,
  };
  if (shipment.state === "queued") {
    return { ...fields, state: "queued" };
  }
  return {
    ...fields,
    state: "dispatched",
    provider: shipment.provider,
    bookingId: shipment.bookingId,
    dispatchedAtMs: shipment.dispatchedAtMs,
  };
}

export function createShippingService(dependencies: ShippingDependencies) {
  async function handle(input: unknown): Promise<ServiceResponse> {
    const command = parseCommand(input);
    if (!command) {
      return { status: 400, body: { code: "invalid_command" } };
    }

    let value: unknown;
    try {
      value = await dependencies.repository.get(command.shipmentId);
    } catch {
      return { status: 500, body: { code: "service_unavailable" } };
    }
    if (value === undefined) {
      return { status: 404, body: { code: "not_found" } };
    }

    // Storage contains the host's queued records or this service's own saved JSON.
    const shipment = value as StoredShipment;
    if (command.op === "get" || shipment.state === "dispatched") {
      return { status: 200, body: publicShipment(shipment) };
    }

    let confirmation: unknown;
    try {
      confirmation = await dependencies.atlas.book({
        shipmentId: shipment.id,
        routeCode: shipment.routeCode,
        parcelGrams: shipment.parcelGrams,
        recipient: {
          name: command.recipient.name,
          postalAddress: command.recipient.postalAddress,
        },
        idempotencyKey: shipment.id,
      });
    } catch {
      return { status: 500, body: { code: "service_unavailable" } };
    }
    if (
      !isObject(confirmation) ||
      typeof confirmation.bookingId !== "string" ||
      confirmation.bookingId.length === 0
    ) {
      return { status: 500, body: { code: "service_unavailable" } };
    }

    const dispatched: DispatchedShipment = {
      schemaVersion: 1,
      id: shipment.id,
      routeCode: shipment.routeCode,
      parcelGrams: shipment.parcelGrams,
      state: "dispatched",
      provider: "atlas",
      bookingId: confirmation.bookingId,
      dispatchedAtMs: command.nowMs,
    };
    try {
      await dependencies.repository.save(shipment.id, dispatched);
    } catch {
      return { status: 500, body: { code: "service_unavailable" } };
    }
    dependencies.logger.info({
      shipmentId: shipment.id,
      action: "dispatched",
      provider: "atlas",
    });
    return { status: 200, body: publicShipment(dispatched) };
  }

  return { handle };
}
