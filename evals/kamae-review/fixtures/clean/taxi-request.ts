/**
 * State transition model for taxi dispatch requests
 *
 * A practical example of state transitions using Discriminated Union + Companion Object + pure functions.
 * Invalid transitions are detected as compile errors.
 */

// --- Branded Types (z.brand) ---

import { z } from "zod";

export const PassengerIdBrand = Symbol();
const PassengerIdSchema = z.string().uuid().brand<typeof PassengerIdBrand>();
type PassengerId = z.infer<typeof PassengerIdSchema>;

export const DriverIdBrand = Symbol();
const DriverIdSchema = z.string().uuid().brand<typeof DriverIdBrand>();
type DriverId = z.infer<typeof DriverIdSchema>;

export const RequestIdBrand = Symbol();
const RequestIdSchema = z.string().uuid().brand<typeof RequestIdBrand>();
type RequestId = z.infer<typeof RequestIdSchema>;

// --- Branded Type Companion Objects ---

const PassengerId = {
  schema: PassengerIdSchema,
  parse: (raw: string) => PassengerIdSchema.safeParse(raw),
} as const;

const DriverId = {
  schema: DriverIdSchema,
  parse: (raw: string) => DriverIdSchema.safeParse(raw),
} as const;

const RequestId = {
  schema: RequestIdSchema,
  parse: (raw: string) => RequestIdSchema.safeParse(raw),
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
