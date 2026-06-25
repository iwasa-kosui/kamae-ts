import { ok, err, Result } from "neverthrow";

declare const DriverIdBrand: unique symbol;
type DriverId = string & { readonly [DriverIdBrand]: never };

declare const ZoneIdBrand: unique symbol;
type ZoneId = string & { readonly [ZoneIdBrand]: never };

declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };

type DriverNotAvailableError = Readonly<{
  kind: "DriverNotAvailableError";
  message: string;
}>;

const DriverNotAvailableError = {
  new: (driverId: DriverId, zoneId: ZoneId): DriverNotAvailableError => ({
    kind: "DriverNotAvailableError",
    message: `Driver ${driverId} is not available in zone ${zoneId}`,
  }),
} as const;

type RequestNotFoundError = Readonly<{
  kind: "RequestNotFoundError";
  message: string;
}>;

const RequestNotFoundError = {
  new: (requestId: RequestId): RequestNotFoundError => ({
    kind: "RequestNotFoundError",
    message: `Request ${requestId} not found`,
  }),
} as const;

type AssignDriverError = DriverNotAvailableError | RequestNotFoundError;

type Driver = Readonly<{
  id: DriverId;
  isAvailable: boolean;
  currentZone: ZoneId;
}>;

type Request = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
  zoneId: ZoneId;
}>;

export const validateAssignment = (
  request: Request,
  driver: Driver,
): Result<Request, AssignDriverError> => {
  if (!driver.isAvailable) {
    return err(DriverNotAvailableError.new(driver.id, request.zoneId));
  }
  return ok(request);
};

export const findRequest = (
  requestId: RequestId,
  requests: ReadonlyArray<Request>,
): Result<Request, AssignDriverError> => {
  const found = requests.find((r) => r.requestId === requestId);
  if (!found) {
    return err(RequestNotFoundError.new(requestId));
  }
  return ok(found);
};
