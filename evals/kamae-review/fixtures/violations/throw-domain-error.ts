type RequestId = string;
type DriverId = string;

type Waiting = Readonly<{ kind: "Waiting"; requestId: RequestId }>;
type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  driverId: DriverId;
}>;

type TaxiRequest = Waiting | EnRoute;

export const assignDriver = (
  request: TaxiRequest,
  driverId: DriverId,
): EnRoute => {
  if (request.kind !== "Waiting") {
    throw new Error("request is not in Waiting state");
  }
  if (driverId.length === 0) {
    throw new Error("driverId is empty");
  }
  return {
    kind: "EnRoute",
    requestId: request.requestId,
    driverId,
  };
};

export const fetchRequest = async (raw: unknown): Promise<TaxiRequest> => {
  const obj = raw as { kind: string; requestId: string; driverId?: string };
  if (obj.kind === "Waiting") {
    return { kind: "Waiting", requestId: obj.requestId as RequestId };
  }
  if (obj.kind === "EnRoute" && obj.driverId) {
    return {
      kind: "EnRoute",
      requestId: obj.requestId as RequestId,
      driverId: obj.driverId as DriverId,
    };
  }
  throw new Error("invalid taxi request payload");
};
