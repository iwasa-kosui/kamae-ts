import { ResultAsync, okAsync, errAsync } from "neverthrow";

declare const DriverIdBrand: unique symbol;
type DriverId = string & { readonly [DriverIdBrand]: never };

declare const ZoneIdBrand: unique symbol;
type ZoneId = string & { readonly [ZoneIdBrand]: never };

declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };

type Driver = Readonly<{
  id: DriverId;
  isAvailable: boolean;
  currentZone: ZoneId;
}>;

type Assignment = Readonly<{
  requestId: RequestId;
  driverId: DriverId;
  isValid: boolean;
}>;

type DriverNotFoundError = Readonly<{ kind: "DriverNotFoundError"; driverId: DriverId }>;
type DriverNotAvailableError = Readonly<{ kind: "DriverNotAvailableError"; driverId: DriverId; zoneId: ZoneId }>;
type DriverOutOfZoneError = Readonly<{ kind: "DriverOutOfZoneError"; driverId: DriverId; zoneId: ZoneId }>;
type InvalidAssignmentError = Readonly<{ kind: "InvalidAssignmentError"; requestId: RequestId; driverId: DriverId }>;

type AssignDriverError =
  | DriverNotFoundError
  | DriverNotAvailableError
  | DriverOutOfZoneError
  | InvalidAssignmentError;

type AssignDriverDeps = Readonly<{
  getDriver: (id: DriverId) => Promise<Driver | undefined>;
}>;

const computeAssignment = (driver: Driver, requestId: RequestId): Assignment => ({
  requestId,
  driverId: driver.id,
  isValid: driver.isAvailable,
});

export const assignDriver = (
  deps: AssignDriverDeps,
  requestId: RequestId,
  driverId: DriverId,
  zoneId: ZoneId,
): ResultAsync<Assignment, AssignDriverError> =>
  ResultAsync.fromPromise(
    deps.getDriver(driverId),
    (): DriverNotFoundError => ({ kind: "DriverNotFoundError", driverId }),
  ).andThen((driver) => {
    if (!driver) {
      return errAsync<Assignment, AssignDriverError>({
        kind: "DriverNotFoundError",
        driverId,
      });
    }
    if (!driver.isAvailable) {
      return errAsync<Assignment, AssignDriverError>({
        kind: "DriverNotAvailableError",
        driverId,
        zoneId,
      });
    }
    if (driver.currentZone !== zoneId) {
      return errAsync<Assignment, AssignDriverError>({
        kind: "DriverOutOfZoneError",
        driverId,
        zoneId,
      });
    }
    const assignment = computeAssignment(driver, requestId);
    if (!assignment.isValid) {
      return errAsync<Assignment, AssignDriverError>({
        kind: "InvalidAssignmentError",
        requestId,
        driverId,
      });
    }
    return okAsync(assignment);
  });
