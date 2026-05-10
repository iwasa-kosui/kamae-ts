import { z } from "zod";

const RequestIdSchema = z.string().uuid();
type RequestId = z.infer<typeof RequestIdSchema>;

const DriverIdSchema = z.string().uuid();
type DriverId = z.infer<typeof DriverIdSchema>;

export class TaxiRequest {
  readonly state: string;
  readonly requestId: RequestId;
  readonly driverId?: DriverId;
  readonly assignedAt?: Date;
  readonly completedAt?: Date;

  constructor(requestId: string) {
    this.state = "waiting";
    this.requestId = requestId as RequestId;
  }

  assignDriver(driverId: string): TaxiRequest {
    if (this.state !== "waiting") {
      throw new Error(`cannot assign in state ${this.state}`);
    }
    const next = new TaxiRequest(this.requestId);
    (next as any).state = "enRoute";
    (next as any).driverId = driverId as DriverId;
    (next as any).assignedAt = new Date();
    return next;
  }
}
