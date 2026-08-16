---
title: fp-ts
parent: エラーハンドリング
grand_parent: 日本語
nav_order: 3
---

# fp-ts

## 基本API

```typescript
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
```

| 関数/型 | 説明 |
|---------|------|
| `Either<E, A>` | 同期 Result 型。エラーが第 1 型引数（Left）、成功が第 2 型引数（Right） |
| `TaskEither<E, A>` | 非同期 Result 型（`() => Promise<Either<E, A>>`） |
| `E.right(value)` | 成功値を生成 |
| `E.left(error)` | 失敗値を生成 |
| `TE.Do` | `TaskEither<never, {}>` を生成。`bind` と組み合わせてオブジェクトを段階的に構築する起点 |
| `TE.bind(name, fn)` | 成功値のオブジェクトに `fn` の結果を `name` キーで追加 |
| `TE.chainFirst(fn)` | 副作用を実行し、成功なら元の値を維持して返す |
| `TE.chainEitherK(fn)` | 同期の `Either` を返す関数を `TaskEither` チェーンに組み込む |

## パイプによる合成

fp-ts ではメソッドチェーンではなく `pipe` で関数を合成します。

```typescript
pipe(
  E.right(value),
  E.map((a) => transform(a)),           // 成功値を変換
  E.mapLeft((e) => transformErr(e)),     // エラー値を変換
  E.chain((a) => nextEither(a)),         // 成功値から次のEitherへ（flatMap）
  E.chainFirst((a) => sideEffect(a)),   // 副作用を実行し、成功なら元の値を維持
  E.fold(
    (error) => handleErr(error),
    (value) => handleOk(value),
  ),
);

// Do + bind: オブジェクトを段階的に組み立てる
pipe(
  TE.Do,                                              // TaskEither<never, {}> から開始
  TE.bind("user", () => findUser(userId)),            // { user: User }
  TE.bind("order", ({ user }) => findOrder(user)),    // { user: User, order: Order }
  TE.chainFirst(({ order }) => validate(order)),      // バリデーション（値は維持）
  TE.map(({ user, order }) => buildResponse(user, order)),
);
```

## コード例: 状態遷移パイプライン

Railway Oriented Programming の原則に従い、想定される各業務判断を独立した関数に切り出し、`pipe` + `Do`/`bind` で合成します。判断に成功した後で永続化し、reject された `Task` を予期しない障害のまま伝播させます。

`RequestResolver` / `RequestStore` の設計と、状態とドメインイベントを同一トランザクションで永続化する方法は [state-modeling.md#ドメインイベント](../state-modeling.md#ドメインイベント) を参照してください。

```typescript
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import type { Task } from "fp-ts/Task";

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
  findById: (id: RequestId) => Task<Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => Task<void>;
}>;

// --- Error Types ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

// --- Domain Functions ---

const ensureExists =
  (requestId: RequestId) =>
  (request: Waiting | undefined): E.Either<AssignDriverError, Waiting> =>
    request !== undefined
      ? E.right(request)
      : E.left({ kind: "RequestNotFound", requestId });

const ensureDriverAvailable =
  (driverId: DriverId, isAvailable: boolean) =>
  (): E.Either<AssignDriverError, DriverId> =>
    isAvailable
      ? E.right(driverId)
      : E.left({ kind: "DriverNotAvailable", driverId });

const transitionToEnRoute = (ctx: {
  waiting: Waiting;
  driverId: DriverId;
}): EnRoute => ({
  kind: "EnRoute",
  requestId: ctx.waiting.requestId,
  passengerId: ctx.waiting.passengerId,
  driverId: ctx.driverId,
});

// --- Use Case (Do + bind による完全パイプライン合成) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): Task<E.Either<AssignDriverError, EnRoute>> =>
  async () => {
    const request = await requestResolver.findById(requestId)();
    const assignment = pipe(
      E.Do,
      // 1. リクエスト取得 → 存在確認
      E.bind("waiting", () =>
        ensureExists(requestId)(request),
      ),
      // 2. ドライバーの空き確認
      E.bind("driverId", () =>
        ensureDriverAvailable(driverId, isDriverAvailable)(),
      ),
      // 3. 状態遷移
      E.map(transitionToEnRoute),
    );

    if (E.isLeft(assignment)) return assignment;

    await requestStore.save(assignment.right)();
    return assignment;
  };
```

## 回復可能な外部障害

ワークフローが回復判断を行える場合に限り、名前付きの外部エラーを `Either` に含めます。

```typescript
type PaymentAuthorizationError = {
  readonly kind: "AuthorizationTemporarilyUnavailable";
  readonly retryAfter: RetryAfter;
};
```

例えば、呼び出し側はこのエラー後に認可を延期または再試行できます。任意の通信障害を包むラッパーではありません。
