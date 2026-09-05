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

## TaskEither の契約とエラー境界

`TaskEither<E, A>` は `Task<Either<E, A>>` と構造的に同じ型です。型名を展開してもエラーの扱いは変わりません。`Task` は失敗しない非同期計算を表し、`TaskEither` は Promise を reject させず、失敗を `Left` で表します。[Task の契約](https://gcanti.github.io/fp-ts/modules/Task.ts.html#task-overview)、[TaskEither の定義](https://gcanti.github.io/fp-ts/modules/TaskEither.ts.html#taskeither-overview) を参照してください。

reject しうる I/O は `TE.tryCatch` で接続します。`TE.fromTask` に渡したり、`tryCatch` のエラーマッパーで再 throw したりしないでください。以下の例では業務エラーを `ExpectedFailure`、想定外障害を `UnexpectedFault` として区別します。パイプラインの実行後に `execute` が業務上の `Either` を返し、想定外障害だけを元の cause のまま再 throw します。この `execute` は reject しうる通常の `Promise` を返すアプリケーション境界です。`Task` や `TaskEither` として宣言しません。

## コード例: 状態遷移パイプライン

取得・業務判断・永続化を `TaskEither` と `pipe` で合成します。異なるエラー型を合成するときは `bindW`・`chainEitherKW`・`chainFirstW` を使います。想定外障害を業務エラー union に追加せず、実行用の `ExecutionFailure` で区別してアプリケーション境界へ渡します。

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

// --- Domain Errors ---

type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

// --- Execution Failures (outside the domain error union) ---

type ExpectedFailure<D> = Readonly<{ kind: "ExpectedFailure"; error: D }>;
type UnexpectedFault = Readonly<{ kind: "UnexpectedFault"; cause: unknown }>;
type ExecutionFailure<D> = ExpectedFailure<D> | UnexpectedFault;

const expectedFailure = <D>(error: D): ExpectedFailure<D> =>
  ({ kind: "ExpectedFailure", error });

const unexpectedFault = (cause: unknown): UnexpectedFault =>
  ({ kind: "UnexpectedFault", cause });

// --- Repository Ports and I/O Adapters ---

type RequestResolver = Readonly<{
  findById: (id: RequestId) => TE.TaskEither<UnexpectedFault, Waiting | undefined>;
}>;

type RequestStore = Readonly<{
  save: (state: EnRoute) => TE.TaskEither<UnexpectedFault, void>;
}>;

const createRequestResolver = (
  findById: (id: RequestId) => Promise<Waiting | undefined>,
): RequestResolver => ({
  findById: (id) => TE.tryCatch(() => findById(id), unexpectedFault),
});

const createRequestStore = (
  save: (state: EnRoute) => Promise<void>,
): RequestStore => ({
  save: (state) => TE.tryCatch(() => save(state), unexpectedFault),
});

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

// --- Use Case (full TaskEither pipeline) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): TE.TaskEither<ExecutionFailure<AssignDriverError>, EnRoute> =>
    pipe(
      TE.Do,
      // 1. Fetch request → verify existence
      TE.bindW("waiting", () =>
        pipe(
          requestResolver.findById(requestId),
          TE.chainEitherKW((request) =>
            pipe(ensureExists(requestId)(request), E.mapLeft(expectedFailure)),
          ),
        ),
      ),
      // 2. Check driver availability
      TE.bindW("driverId", () =>
        pipe(
          ensureDriverAvailable(driverId, isDriverAvailable)(),
          E.mapLeft(expectedFailure),
          TE.fromEither,
        ),
      ),
      // 3. State transition
      TE.map(transitionToEnRoute),
      // 4. Persist, preserving the assigned state
      TE.chainFirstW(requestStore.save),
    );

// --- Application Execution Boundary ---

const execute = async <D, A>(
  task: TE.TaskEither<ExecutionFailure<D>, A>,
): Promise<E.Either<D, A>> => {
  const result = await task();
  return pipe(
    result,
    E.match(
      (failure): E.Either<D, A> => {
        switch (failure.kind) {
          case "ExpectedFailure":
            return E.left(failure.error);
          case "UnexpectedFault":
            throw failure.cause;
        }
      },
      (value) => E.right(value),
    ),
  );
};
```

アプリケーション側では `await execute(assignDriverUseCase(resolver, store)(requestId, driverId, true))` と実行します。呼び出し側が受け取る `Either` のエラー型は `AssignDriverError` のままです。`UnexpectedFault` は業務結果として公開せず、上位のエラーハンドラーがログ記録と汎用的な障害レスポンスを担います。

## 回復可能な外部障害

ワークフローが回復判断を行える場合に限り、名前付きの外部エラーをドメインの `Either` エラー union に含めます。

```typescript
type PaymentAuthorizationError = {
  readonly kind: "AuthorizationTemporarilyUnavailable";
  readonly retryAfter: RetryAfter;
};
```

例えば、呼び出し側はこのエラー後に認可を延期または再試行できます。任意の通信障害を包むラッパーではありません。
