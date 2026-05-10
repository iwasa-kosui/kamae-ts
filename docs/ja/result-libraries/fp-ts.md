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

Railway Oriented Programming の原則に従い、各処理を独立した関数に切り出し、ユースケースは `pipe` + `Do`/`bind`/`chainFirst` でそれらを合成するだけにします。

`RequestResolver` / `RequestStore` の設計と、状態とドメインイベントを同一トランザクションで永続化する方法は [state-modeling.md#ドメインイベント](../state-modeling.md#ドメインイベント) を参照してください。

```typescript
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";

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
  findById: (id: RequestId) => TE.TaskEither<RepositoryError, Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => TE.TaskEither<RepositoryError, void>;
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
  ): TE.TaskEither<AssignDriverError, EnRoute> =>
    pipe(
      TE.Do,
      // 1. リクエスト取得 → 存在確認
      TE.bind("waiting", () =>
        pipe(
          requestResolver.findById(requestId),
          TE.chainEitherK(ensureExists(requestId)),
        ),
      ),
      // 2. ドライバーの空き確認
      TE.bind("driverId", () =>
        TE.fromEither(ensureDriverAvailable(driverId, isDriverAvailable)()),
      ),
      // 3. 状態遷移
      TE.map(transitionToEnRoute),
      // 4. 永続化
      TE.chainFirst(requestStore.save),
    );
```
