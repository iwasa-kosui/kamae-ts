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
  beacon: {
    reserve(request: ProviderRequest): Promise<unknown>;
  };
  logger: {
    info(event: Record<string, unknown>): void;
  };
}

type Provider = "atlas" | "beacon";
type RefusalReason = "unsupported_route" | "unsupported_parcel";

interface Refusal {
  provider: Provider;
  reason: RefusalReason;
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
  provider: Provider;
  bookingId: string;
  dispatchedAtMs: number;
}

interface DeferredShipment extends ShipmentFields {
  state: "deferred";
  nextProvider: Provider;
  retryAtMs: number;
  rejections: Refusal[];
}

interface UnavailableShipment extends ShipmentFields {
  state: "unavailable";
  rejections: Refusal[];
}

type StoredShipment =
  | QueuedShipment
  | DispatchedShipment
  | DeferredShipment
  | UnavailableShipment;

type Decision = DispatchedShipment | DeferredShipment | UnavailableShipment;

export type PublicShipment =
  | Omit<QueuedShipment, "schemaVersion">
  | Omit<DispatchedShipment, "schemaVersion">
  | Omit<DeferredShipment, "schemaVersion">
  | Omit<UnavailableShipment, "schemaVersion">;

type FailedAt = Provider | "repository";
type FailureClassification =
  | "unknown_failure"
  | "invalid_provider_response"
  | "repository_failure";

interface AbortBody {
  code: "dispatch_aborted";
  shipmentId: string;
  failedAt: FailedAt;
  classification: FailureClassification;
  rejections: Refusal[];
}

export interface ServiceResponse {
  status: number;
  body: PublicShipment | AbortBody | { code: "invalid_command" | "not_found" };
}

type Command =
  | { op: "get"; shipmentId: string }
  | { op: "dispatch"; shipmentId: string; nowMs: number; recipient: Recipient };

type Attempt =
  | { kind: "booked"; bookingId: string }
  | { kind: "refused"; reason: RefusalReason }
  | { kind: "rate_limited"; retryAtMs: number }
  | { kind: "unknown" }
  | { kind: "invalid" };

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

function copyRejections(rejections: Refusal[]): Refusal[] {
  return rejections.map(({ provider, reason }) => ({ provider, reason }));
}

function storedFields(shipment: StoredShipment): ShipmentFields {
  return {
    schemaVersion: 1,
    id: shipment.id,
    routeCode: shipment.routeCode,
    parcelGrams: shipment.parcelGrams,
  };
}

function publicShipment(shipment: StoredShipment): PublicShipment {
  const fields = {
    id: shipment.id,
    routeCode: shipment.routeCode,
    parcelGrams: shipment.parcelGrams,
  };
  switch (shipment.state) {
    case "queued":
      return { ...fields, state: "queued" };
    case "dispatched":
      return {
        ...fields,
        state: "dispatched",
        provider: shipment.provider,
        bookingId: shipment.bookingId,
        dispatchedAtMs: shipment.dispatchedAtMs,
      };
    case "deferred":
      return {
        ...fields,
        state: "deferred",
        nextProvider: shipment.nextProvider,
        retryAtMs: shipment.retryAtMs,
        rejections: copyRejections(shipment.rejections),
      };
    case "unavailable":
      return {
        ...fields,
        state: "unavailable",
        rejections: copyRejections(shipment.rejections),
      };
  }
}

function isRefusalReason(value: unknown): value is RefusalReason {
  return value === "unsupported_route" || value === "unsupported_parcel";
}

function isFutureDeadline(value: unknown, nowMs: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > nowMs;
}

function classifyRejection(provider: Provider, value: unknown, nowMs: number): Attempt {
  if (provider === "atlas" && isObject(value)) {
    if (value.code === "cannot_ship") {
      return isRefusalReason(value.reason)
        ? { kind: "refused", reason: value.reason }
        : { kind: "invalid" };
    }
    if (value.code === "rate_limited") {
      return isFutureDeadline(value.retryAtMs, nowMs)
        ? { kind: "rate_limited", retryAtMs: value.retryAtMs }
        : { kind: "invalid" };
    }
  }
  if (provider === "beacon" && isObject(value)) {
    if (value.type === "rejected") {
      return isObject(value.details) && isRefusalReason(value.details.reason)
        ? { kind: "refused", reason: value.details.reason }
        : { kind: "invalid" };
    }
    if (value.type === "throttled") {
      return isObject(value.details) && isFutureDeadline(value.details.retryAtMs, nowMs)
        ? { kind: "rate_limited", retryAtMs: value.details.retryAtMs }
        : { kind: "invalid" };
    }
  }
  return { kind: "unknown" };
}

export function createShippingService(dependencies: ShippingDependencies) {
  function abort(
    shipmentId: string,
    failedAt: FailedAt,
    classification: FailureClassification,
    rejections: Refusal[],
  ): ServiceResponse {
    dependencies.logger.info({
      shipmentId,
      action: "aborted",
      failedAt,
      classification,
      rejections: copyRejections(rejections),
    });
    return {
      status: 500,
      body: {
        code: "dispatch_aborted",
        shipmentId,
        failedAt,
        classification,
        rejections: copyRejections(rejections),
      },
    };
  }

  async function attempt(
    provider: Provider,
    shipment: StoredShipment,
    command: Extract<Command, { op: "dispatch" }>,
  ): Promise<Attempt> {
    const request: ProviderRequest = {
      shipmentId: shipment.id,
      routeCode: shipment.routeCode,
      parcelGrams: shipment.parcelGrams,
      recipient: {
        name: command.recipient.name,
        postalAddress: command.recipient.postalAddress,
      },
      idempotencyKey: shipment.id,
    };
    let confirmation: unknown;
    try {
      confirmation = provider === "atlas"
        ? await dependencies.atlas.book(request)
        : await dependencies.beacon.reserve(request);
    } catch (cause) {
      return classifyRejection(provider, cause, command.nowMs);
    }

    if (!isObject(confirmation)) {
      return { kind: "invalid" };
    }
    const bookingId = provider === "atlas" ? confirmation.bookingId : confirmation.reference;
    return typeof bookingId === "string" && bookingId.length > 0
      ? { kind: "booked", bookingId }
      : { kind: "invalid" };
  }

  async function commit(decision: Decision, rejections: Refusal[]): Promise<ServiceResponse> {
    try {
      await dependencies.repository.save(decision.id, decision);
    } catch {
      return abort(decision.id, "repository", "repository_failure", rejections);
    }

    switch (decision.state) {
      case "dispatched":
        dependencies.logger.info({
          shipmentId: decision.id,
          action: "dispatched",
          provider: decision.provider,
        });
        return { status: 200, body: publicShipment(decision) };
      case "deferred":
        dependencies.logger.info({
          shipmentId: decision.id,
          action: "deferred",
          provider: decision.nextProvider,
          retryAtMs: decision.retryAtMs,
          rejections: copyRejections(decision.rejections),
        });
        return { status: 202, body: publicShipment(decision) };
      case "unavailable":
        dependencies.logger.info({
          shipmentId: decision.id,
          action: "unavailable",
          rejections: copyRejections(decision.rejections),
        });
        return { status: 422, body: publicShipment(decision) };
    }
  }

  async function handle(input: unknown): Promise<ServiceResponse> {
    const command = parseCommand(input);
    if (!command) {
      return { status: 400, body: { code: "invalid_command" } };
    }

    let value: unknown;
    try {
      value = await dependencies.repository.get(command.shipmentId);
    } catch {
      return abort(command.shipmentId, "repository", "repository_failure", []);
    }
    if (value === undefined) {
      return { status: 404, body: { code: "not_found" } };
    }

    // Storage contains host-created or service-produced records, including JSON reloads.
    const shipment = value as StoredShipment;
    if (command.op === "get" || shipment.state === "dispatched") {
      return { status: 200, body: publicShipment(shipment) };
    }
    if (shipment.state === "unavailable") {
      return { status: 422, body: publicShipment(shipment) };
    }
    if (shipment.state === "deferred" && command.nowMs < shipment.retryAtMs) {
      return { status: 202, body: publicShipment(shipment) };
    }

    let provider: Provider = shipment.state === "deferred" ? shipment.nextProvider : "atlas";
    let rejections = shipment.state === "deferred" ? copyRejections(shipment.rejections) : [];

    while (true) {
      const result = await attempt(provider, shipment, command);
      switch (result.kind) {
        case "booked":
          return commit({
            ...storedFields(shipment),
            state: "dispatched",
            provider,
            bookingId: result.bookingId,
            dispatchedAtMs: command.nowMs,
          }, rejections);
        case "rate_limited":
          return commit({
            ...storedFields(shipment),
            state: "deferred",
            nextProvider: provider,
            retryAtMs: result.retryAtMs,
            rejections: copyRejections(rejections),
          }, rejections);
        case "refused":
          rejections = [...rejections, { provider, reason: result.reason }];
          if (provider === "atlas") {
            provider = "beacon";
            continue;
          }
          return commit({
            ...storedFields(shipment),
            state: "unavailable",
            rejections: copyRejections(rejections),
          }, rejections);
        case "unknown":
          return abort(shipment.id, provider, "unknown_failure", rejections);
        case "invalid":
          return abort(shipment.id, provider, "invalid_provider_response", rejections);
      }
    }
  }

  return { handle };
}
