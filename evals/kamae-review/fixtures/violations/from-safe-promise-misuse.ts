import { ResultAsync, okAsync, errAsync } from "neverthrow";

declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };

declare const DriverIdBrand: unique symbol;
type DriverId = string & { readonly [DriverIdBrand]: never };

type Waiting = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  driverId: DriverId;
}>;

type Assignment = Waiting | EnRoute;

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

type AssignDriverDeps = Readonly<{
  getRequest: (id: RequestId) => Promise<Waiting | undefined>;
  checkDriverAvailable: (id: DriverId) => Promise<boolean>;
  save: (assignment: EnRoute) => Promise<void>;
}>;

type AssignDriverInput = Readonly<{
  requestId: RequestId;
  driverId: DriverId;
}>;

export const assignDriver = (
  deps: AssignDriverDeps,
  input: AssignDriverInput,
): ResultAsync<EnRoute, AssignDriverError> =>
  ResultAsync.fromSafePromise(deps.getRequest(input.requestId))
    .andThen((request) =>
      request !== undefined
        ? okAsync(request)
        : errAsync({ kind: "RequestNotFound" as const, requestId: input.requestId }),
    )
    .andThen((waiting) =>
      ResultAsync.fromSafePromise(deps.checkDriverAvailable(input.driverId)).andThen(
        (available) =>
          available
            ? okAsync(waiting)
            : errAsync({ kind: "DriverNotAvailable" as const, driverId: input.driverId }),
      ),
    )
    .andThen((waiting) => {
      const enRoute: EnRoute = {
        kind: "EnRoute",
        requestId: waiting.requestId,
        driverId: input.driverId,
      };
      return ResultAsync.fromSafePromise(deps.save(enRoute)).map(() => enRoute);
    });
