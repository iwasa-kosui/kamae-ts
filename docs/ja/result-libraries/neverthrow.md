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
| `Result<T, E>` | 同期 Result 型 |
| `ResultAsync<T, E>` | 非同期 Result 型（Promise<Result> のラッパー） |
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

Railway Oriented Programming の原則に従い、想定される各業務判断を独立した関数に切り出し、メソッドチェーンで合成します。判断に成功した後でのみ永続化し、reject された Promise を予期しない障害のまま伝播させます。

`RequestResolver` / `RequestStore` の設計と、状態とドメインイベントを同一トランザクションで永続化する方法は [state-modeling.md#ドメインイベント](../state-modeling.md#ドメインイベント) を参照してください。

```typescript
import { ok, err, Result } from "neverthrow";

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
  findById: (id: RequestId) => Promise<Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => Promise<void>;
}>;

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

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

// --- Use Case (想定される結果のパイプラインと通常の非同期永続化) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    const assignment = ok(request)
      .andThen(ensureExists(requestId))
      .andThen(ensureDriverAvailable(driverId, isDriverAvailable))
      .map(transitionToEnRoute(driverId));

    return assignment.match(
      async (enRoute) => {
        await requestStore.save(enRoute);
        return ok(enRoute);
      },
      err,
    );
  };
```

## 回復可能な外部障害

ワークフローが回復判断を行える場合に限り、名前付きの外部エラーを `Result` に含めます。

```typescript
type PaymentAuthorizationError = {
  readonly kind: "AuthorizationTemporarilyUnavailable";
  readonly retryAfter: RetryAfter;
};
```

例えば、呼び出し側はこのエラー後に認可を延期または再試行できます。任意の通信障害を包むラッパーではありません。別の名前付き外部障害に回復方法が定義されている場合も、汎用エラーではなく正確な `ExternalServiceError` を使います。
