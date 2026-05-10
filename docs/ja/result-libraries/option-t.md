# option-t

## 基本API

```typescript
import { createOk, createErr, isOk, isErr, unwrapOk } from "option-t/plain_result";
import { mapForResult } from "option-t/plain_result/map";
import { andThenForResult } from "option-t/plain_result/and_then";
import { andThenAsyncForResult } from "option-t/plain_result/and_then_async";
import { mapErrForResult } from "option-t/plain_result/map_err";
import { orElseForResult } from "option-t/plain_result/or_else";
```

または名前空間import:

```typescript
import { Result } from "option-t/plain_result/namespace";
// Result.createOk, Result.map, Result.andThen, etc.
```

| 関数/型 | 説明 |
|---------|------|
| `Result<T, E>` | Result型（`Ok<T> \| Err<E>` の判別共用体、プレーンオブジェクト） |
| `createOk(value)` | 成功値を生成（`{ ok: true, val: T, err: null }`） |
| `createErr(error)` | 失敗値を生成（`{ ok: false, val: null, err: E }`） |

neverthrowとの主な違い:

- クラスではなくプレーンオブジェクト（discriminantは `ok` フィールド）
- メソッドチェーンではなくスタンドアロン関数で合成
- 非同期は `*Async` バリアント関数を使用（戻り値は `Promise<Result<T, E>>`）

## 関数による合成

```typescript
import { mapForResult } from "option-t/plain_result/map";
import { mapErrForResult } from "option-t/plain_result/map_err";
import { andThenForResult } from "option-t/plain_result/and_then";
import { orElseForResult } from "option-t/plain_result/or_else";

const mapped = mapForResult(result, (value) => transform(value));
const mappedErr = mapErrForResult(result, (error) => transformErr(error));
const chained = andThenForResult(result, (value) => nextResult(value));
const recovered = orElseForResult(result, (error) => recover(error));

// 分岐は型ガードまたはokフィールドで判定
if (isOk(result)) {
  console.log(result.val);
} else {
  console.log(result.err);
}
```

## コード例: ドメインイベントの記録

```typescript
import { createOk, createErr, isOk, isErr, type Result } from "option-t/plain_result";
import { andThenForResult } from "option-t/plain_result/and_then";
import { andThenAsyncForResult } from "option-t/plain_result/and_then_async";
import { mapAsyncForResult } from "option-t/plain_result/map_async";

// --- Branded Types ---

declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };

declare const DriverIdBrand: unique symbol;
type DriverId = string & { readonly [DriverIdBrand]: never };

declare const PassengerIdBrand: unique symbol;
type PassengerId = string & { readonly [PassengerIdBrand]: never };

// --- Domain Event ---

type DomainEvent<TName extends string, TPayload> = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: TName;
  payload: TPayload;
  aggregateId: string;
  aggregateName: string;
}>;

type DriverAssignedEvent = DomainEvent<
  "DriverAssigned",
  Readonly<{ driverId: DriverId; passengerId: PassengerId }>
>;

// --- State Types ---

type Waiting = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
  passengerId: PassengerId;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
}>;

// --- Repository Types ---

type RequestRepository = {
  findById: (id: RequestId) => Promise<Result<Waiting | undefined, RepositoryError>>;
  save: (request: EnRoute) => Promise<Result<void, RepositoryError>>;
};

type EventStore = {
  save: (event: DriverAssignedEvent) => Promise<Result<void, RepositoryError>>;
};

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RepositoryError"; cause: unknown }>;

type RepositoryError = Readonly<{ kind: "RepositoryError"; cause: unknown }>;

// --- Use Case ---

const assignDriverUseCase =
  (requestRepo: RequestRepository, eventStore: EventStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const requestResult = await requestRepo.findById(requestId);

    const waitingResult = andThenForResult(requestResult, (request) =>
      request !== undefined
        ? createOk(request)
        : createErr({ kind: "RequestNotFound" as const, requestId }),
    );

    if (isErr(waitingResult)) return waitingResult;

    const waiting = waitingResult.val;

    if (!isDriverAvailable) {
      return createErr({ kind: "DriverNotAvailable" as const, driverId });
    }

    const enRoute: EnRoute = {
      kind: "EnRoute",
      requestId: waiting.requestId,
      passengerId: waiting.passengerId,
      driverId,
    };

    const event: DriverAssignedEvent = {
      eventId: crypto.randomUUID(),
      eventAt: now,
      eventName: "DriverAssigned",
      payload: { driverId, passengerId: waiting.passengerId },
      aggregateId: waiting.requestId,
      aggregateName: "TaxiRequest",
    };

    const saveResult = await requestRepo.save(enRoute);
    if (isErr(saveResult)) return saveResult;

    const eventResult = await eventStore.save(event);
    if (isErr(eventResult)) return eventResult;

    return createOk(enRoute);
  };
```
