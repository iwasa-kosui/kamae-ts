/**
 * State transition model for taxi dispatch requests
 *
 * A practical example of state transitions using Discriminated Union + Companion Object + pure functions.
 * Invalid transitions are detected as compile errors.
 */

// --- Branded Types (.brand) ---

import { type } from "arktype";

const PassengerIdSchema = type("string.uuid").brand("PassengerId");
type PassengerId = typeof PassengerIdSchema.infer;

const DriverIdSchema = type("string.uuid").brand("DriverId");
type DriverId = typeof DriverIdSchema.infer;

const RequestIdSchema = type("string.uuid").brand("RequestId");
type RequestId = typeof RequestIdSchema.infer;

// --- Branded Type Companion Objects ---

const PassengerId = {
  schema: PassengerIdSchema,
  parse: (raw: string) => {
    const result = PassengerIdSchema(raw);
    return result instanceof type.errors ? { success: false as const, issues: result } : { success: true as const, value: result };
  },
} as const;

const DriverId = {
  schema: DriverIdSchema,
  parse: (raw: string) => {
    const result = DriverIdSchema(raw);
    return result instanceof type.errors ? { success: false as const, issues: result } : { success: true as const, value: result };
  },
} as const;

const RequestId = {
  schema: RequestIdSchema,
  parse: (raw: string) => {
    const result = RequestIdSchema(raw);
    return result instanceof type.errors ? { success: false as const, issues: result } : { success: true as const, value: result };
  },
} as const;

// --- State Types ---

type Waiting = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
  passengerId: PassengerId;
  createdAt: Date;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  assignedAt: Date;
}>;

type InTrip = Readonly<{
  kind: "InTrip";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  startedAt: Date;
}>;

type Completed = Readonly<{
  kind: "Completed";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  startedAt: Date;
  completedAt: Date;
}>;

type Cancelled = Readonly<{
  kind: "Cancelled";
  requestId: RequestId;
  passengerId: PassengerId;
  cancelledAt: Date;
  reason: string;
}>;

// --- Union Type ---

type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;
type CancellableRequest = Waiting | EnRoute | InTrip;

// --- Companion Object ---

const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
};

const TaxiRequest = {
  create: (requestId: RequestId, passengerId: PassengerId, now: Date): Waiting => ({
    kind: "Waiting",
    requestId,
    passengerId,
    createdAt: now,
  }),

  assignDriver: (waiting: Waiting, driverId: DriverId, now: Date): EnRoute => ({
    kind: "EnRoute",
    requestId: waiting.requestId,
    passengerId: waiting.passengerId,
    driverId,
    assignedAt: now,
  }),

  startTrip: (enRoute: EnRoute, now: Date): InTrip => ({
    kind: "InTrip",
    requestId: enRoute.requestId,
    passengerId: enRoute.passengerId,
    driverId: enRoute.driverId,
    startedAt: now,
  }),

  complete: (inTrip: InTrip, now: Date): Completed => ({
    kind: "Completed",
    requestId: inTrip.requestId,
    passengerId: inTrip.passengerId,
    driverId: inTrip.driverId,
    startedAt: inTrip.startedAt,
    completedAt: now,
  }),

  cancel: (request: CancellableRequest, reason: string, now: Date): Cancelled => ({
    kind: "Cancelled",
    requestId: request.requestId,
    passengerId: request.passengerId,
    cancelledAt: now,
    reason,
  }),

  isCancellable: (request: TaxiRequest): request is CancellableRequest =>
    request.kind === "Waiting" ||
    request.kind === "EnRoute" ||
    request.kind === "InTrip",

  isTerminal: (request: TaxiRequest): request is Completed | Cancelled =>
    request.kind === "Completed" || request.kind === "Cancelled",

  describe: (request: TaxiRequest): string => {
    switch (request.kind) {
      case "Waiting":
        return `Waiting (created ${request.createdAt.toISOString()})`;
      case "EnRoute":
        return `Driver ${request.driverId} en route`;
      case "InTrip":
        return `In trip since ${request.startedAt.toISOString()}`;
      case "Completed":
        return `Completed at ${request.completedAt.toISOString()}`;
      case "Cancelled":
        return `Cancelled: ${request.reason}`;
      default:
        return assertNever(request);
    }
  },
} as const;
