---
title: byethrow
parent: エラーハンドリング
grand_parent: 日本語
nav_order: 2
---

# @praha/byethrow

## 基本API

```typescript
import { Result } from "@praha/byethrow";
```

| 関数/型 | 説明 |
|---------|------|
| `Result.Result<T, E>` | Result 型（`Success<T> \| Failure<E>` の判別共用体、プレーンオブジェクト） |
| `Result.ResultAsync<T, E>` | `Promise<Result<T, E>>` の型エイリアス |
| `Result.succeed(value)` | 成功値を生成（`{ type: "Success", value }`） |
| `Result.fail(error)` | 失敗値を生成（`{ type: "Failure", error }`） |
| `Result.do()` | `Success<{}>` を生成。`bind` と組み合わせてオブジェクトを段階的に構築する起点 |
| `Result.bind(name, fn)` | 成功値のオブジェクトに `fn` の結果を `name` キーで追加（`andThen` + マージ） |
| `Result.andThrough(fn)` | 副作用を実行し、成功なら元の値を維持して返す |
| `Result.orThrough(fn)` | エラー側の副作用を実行し、失敗なら元のエラーを維持して返す |

neverthrow との主な違いは次のとおりです。

- クラスではなくプレーンオブジェクト（discriminant は `type` フィールド）
- メソッドチェーンではなく `Result.pipe` + カリー化関数で合成
- `andThrough` / `orThrough` で副作用を挟みつつ元の値を維持できる

## パイプによる合成

```typescript
Result.pipe(
  result,
  Result.map((value) => transform(value)),         // 成功値を変換
  Result.mapError((error) => transformErr(error)),  // エラー値を変換
  Result.andThen((value) => nextResult(value)),     // 成功値から次のResultへ（flatMap）
  Result.andThrough((value) => sideEffect(value)),  // 副作用を実行し、成功なら元の値を維持
  Result.orElse((error) => recover(error)),         // エラーから回復
);

// 非同期: andThen/andThrough に Promise<Result> を返す関数を渡すと
// パイプ全体が自動的に Promise に昇格する（ResultMaybeAsync）
Result.pipe(
  result,
  Result.andThen((value) => fetchSomething(value)), // ResultAsync を返してもOK
  Result.andThrough((value) => saveToDb(value)),    // 副作用も非同期対応
);

// do + bind: オブジェクトを段階的に組み立てる
Result.pipe(
  Result.do(),                                       // Success<{}> から開始
  Result.bind("user", () => findUser(userId)),       // { user: User }
  Result.bind("order", ({ user }) => findOrder(user)), // { user: User, order: Order }
  Result.andThrough(({ order }) => validate(order)), // バリデーション（値は維持）
  Result.map(({ user, order }) => buildResponse(user, order)),
);

// 分岐は型ガードで行う
if (Result.isSuccess(result)) {
  console.log(result.value);
} else {
  console.log(result.error);
}
```

## コード例: 状態遷移パイプライン

Railway Oriented Programming の原則に従い、想定される各業務判断を独立した関数に切り出し、`Result.pipe` で合成します。判断に成功した後でのみ永続化し、reject された Promise を予期しない障害のまま伝播させます。

`RequestResolver` / `RequestStore` の設計と、状態とドメインイベントを同一トランザクションで永続化する方法は [state-modeling.md#ドメインイベント](../state-modeling.md#ドメインイベント) を参照してください。

```typescript
import { Result } from "@praha/byethrow";

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
  (request: Waiting | undefined): Result.Result<Waiting, AssignDriverError> =>
    request !== undefined
      ? Result.succeed(request)
      : Result.fail({ kind: "RequestNotFound", requestId });

const ensureDriverAvailable =
  (driverId: DriverId, isAvailable: boolean) =>
  (): Result.Result<DriverId, AssignDriverError> =>
    isAvailable
      ? Result.succeed(driverId)
      : Result.fail({ kind: "DriverNotAvailable", driverId });

const transitionToEnRoute = (ctx: {
  waiting: Waiting;
  driverId: DriverId;
}): EnRoute => ({
  kind: "EnRoute",
  requestId: ctx.waiting.requestId,
  passengerId: ctx.waiting.passengerId,
  driverId: ctx.driverId,
});

// --- Use Case (do + bind による完全パイプライン合成) ---

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
  ): Promise<Result.Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    const assignment = Result.pipe(
      Result.do(),
      // 1. リクエスト取得 → 存在確認
      Result.bind("waiting", () =>
        ensureExists(requestId)(request),
      ),
      // 2. ドライバーの空き確認
      Result.bind("driverId", () =>
        ensureDriverAvailable(driverId, isDriverAvailable)(),
      ),
      // 3. 状態遷移
      Result.map(transitionToEnRoute),
    );

    if (!Result.isSuccess(assignment)) return assignment;

    await requestStore.save(assignment.value);
    return assignment;
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

例えば、呼び出し側はこのエラー後に認可を延期または再試行できます。任意の通信障害を包むラッパーではありません。
