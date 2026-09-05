type DriverId = string;
type RequestId = string;

type DriverNotAvailable = Readonly<{
  kind: "DriverNotAvailable";
  driverId: DriverId;
}>;

type PersistenceFailure = Readonly<{
  kind: "PersistenceFailure";
  details: unknown;
}>;

type AssignDriverError = DriverNotAvailable | PersistenceFailure;

type Result<Success, Failure> =
  | Readonly<{ ok: true; value: Success }>
  | Readonly<{ ok: false; error: Failure }>;

type Assignment = Readonly<{
  requestId: RequestId;
  driverId: DriverId;
}>;

interface AssignmentRepository {
  assign(requestId: RequestId, driverId: DriverId): Promise<Assignment>;
}

export const assignDriver = async (
  repository: AssignmentRepository,
  requestId: RequestId,
  driverId: DriverId,
): Promise<Result<Assignment, AssignDriverError>> => {
  try {
    const assignment = await repository.assign(requestId, driverId);
    return { ok: true, value: assignment };
  } catch (reason: unknown) {
    return {
      ok: false,
      error: { kind: "PersistenceFailure", details: reason },
    };
  }
};
