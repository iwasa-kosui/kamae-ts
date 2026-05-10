---
title: neverthrow
parent: エラーハンドリング
grand_parent: 日本語
nav_order: 1
---

# neverthrow

## 基本API

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow";
```

| 関数/型 | 説明 |
|---------|------|
| `Result<T, E>` | 同期Result型 |
| `ResultAsync<T, E>` | 非同期Result型（Promise<Result>のラッパー） |
| `ok(value)` | 成功値を生成 |
| `err(error)` | 失敗値を生成 |
| `.andThrough(fn)` | 副作用を実行し、成功なら元の値を維持して返す |

## チェーンメソッド

```typescript
result
  .map((value) => transform(value))         // 成功値を変換
  .mapErr((error) => transformErr(error))    // エラー値を変換
  .andThen((value) => nextResult(value))     // 成功値から次のResultへ（flatMap）
  .andThrough((value) => sideEffect(value))  // 副作用を実行し、成功なら元の値を維持
  .orElse((error) => recover(error))         // エラーから回復
  .match(
    (value) => handleOk(value),
    (error) => handleErr(error),
  );
```

## コード例: 状態遷移パイプライン

Railway Oriented Programmingの原則に従い、各処理を独立した関数に切り出し、ユースケースはメソッドチェーンでそれらを合成するだけにする。`andThrough` で副作用を挟みつつ元の値を維持する。

`RequestResolver` / `RequestStore` の設計と、状態とドメインイベントを同一トランザクションで永続化する方法は [state-modeling.md#ドメインイベント](../state-modeling.md#ドメインイベント) を参照。

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow";

// --- Branded Types ---

declare const RequestIdBrand: unique symbol;
type RequestId = string & { readonly [RequestIdBrand]: never };

declare const DriverIdBrand: unique symbol;
type DriverId = string & { readonly [DriverIdBrand]: never };

declare const PassengerIdBrand: unique symbol;
type PassengerId = string & { readonly [PassengerIdBrand]: never };

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

type RequestResolver = Readonly<{
  findById: (id: RequestId) => ResultAsync<Waiting | undefined, RepositoryError>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => ResultAsync<void, RepositoryError>;
}>;

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RepositoryError"; cause: unknown }>;

type RepositoryError = Readonly<{ kind: "RepositoryError"; cause: unknown }>;

// --- Domain Functions ---

const ensureExists =
  (requestId: RequestId) =>
  (request: Waiting | undefined): Result<Waiting, AssignDriverError> =>
    request !== undefined
      ? ok(request)
      : err({ kind: "RequestNotFound", requestId });

const ensureDriverAvailable =
  (driverId: DriverId, isAvailable: boolean) =>
  (waiting: Waiting): Result<Waiting, AssignDriverError> =>
    isAvailable
      ? ok(waiting)
      : err({ kind: "DriverNotAvailable", driverId });

const transitionToEnRoute =
  (driverId: DriverId) =>
  (waiting: Waiting): EnRoute => ({
    kind: "EnRoute",
    requestId: waiting.requestId,
    passengerId: waiting.passengerId,
    driverId,
  });

// --- Use Case (andThrough によるパイプライン合成) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): ResultAsync<EnRoute, AssignDriverError> =>
    requestResolver
      .findById(requestId)
      .andThen(ensureExists(requestId))
      .andThen(ensureDriverAvailable(driverId, isDriverAvailable))
      .map(transitionToEnRoute(driverId))
      .andThrough(requestStore.save);
```
