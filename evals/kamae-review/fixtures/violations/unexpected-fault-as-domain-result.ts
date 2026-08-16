type DriverId = string;
type RequestId = string;

type DriverNotAvailable = Readonly<{
  kind: "DriverNotAvailable";
  driverId: DriverId;
}>;

type RepositoryError = {
  readonly kind: "RepositoryError";
  readonly cause: unknown;
};

type AssignDriverError = DriverNotAvailable | RepositoryError;

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
  } catch (error: unknown) {
    return {
      ok: false,
      error: { kind: "RepositoryError", cause: error },
    };
  }
};
