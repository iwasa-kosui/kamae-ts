---
title: 関数による状態遷移
parent: 日本語
nav_order: 2
---

# 状態モデリング詳細ガイド

## Discriminated Unionによる状態遷移の設計

### 設計手順

1. ドメインエンティティが取りうる状態を列挙します
2. 各状態で必要なプロパティを特定します
3. 状態ごとに個別の型を定義します（`kind` を discriminant とします）
4. Union 型でまとめます
5. 有効な遷移を純粋関数として定義します
6. Companion Object に関数をまとめます

### 状態遷移図からコードへ

```
Waiting → EnRoute → InTrip → Completed
  ↓         ↓        ↓
Cancelled Cancelled Cancelled
```

この遷移図は以下のように型と関数に変換できます。

```typescript
// 1. 各状態の型
type Waiting = Readonly<{
  kind: "Waiting";
  requestId: RequestId;
  passengerId: PassengerId;
  createdAt: Date;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  assignedAt: Date;
}>;

type InTrip = Readonly<{
  kind: "InTrip";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  startedAt: Date;
}>;

type Completed = Readonly<{
  kind: "Completed";
  requestId: RequestId;
  passengerId: PassengerId;
  driverId: DriverId;
  startedAt: Date;
  completedAt: Date;
}>;

type Cancelled = Readonly<{
  kind: "Cancelled";
  requestId: RequestId;
  passengerId: PassengerId;
  cancelledAt: Date;
  reason: string;
}>;

// 2. Union型
type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;

// 3. Cancellable な状態のUnion（部分的なUnionも活用する）
type CancellableRequest = Waiting | EnRoute | InTrip;

// 4. 遷移関数
const TaxiRequest = {
  assignDriver: (waiting: Waiting, driverId: DriverId, now: Date): EnRoute => ({
    kind: "EnRoute",
    requestId: waiting.requestId,
    passengerId: waiting.passengerId,
    driverId,
    assignedAt: now,
  }),

  startTrip: (enRoute: EnRoute, now: Date): InTrip => ({
    kind: "InTrip",
    requestId: enRoute.requestId,
    passengerId: enRoute.passengerId,
    driverId: enRoute.driverId,
    startedAt: now,
  }),

  complete: (inTrip: InTrip, now: Date): Completed => ({
    kind: "Completed",
    requestId: inTrip.requestId,
    passengerId: inTrip.passengerId,
    driverId: inTrip.driverId,
    startedAt: inTrip.startedAt,
    completedAt: now,
  }),

  cancel: (request: CancellableRequest, reason: string, now: Date): Cancelled => ({
    kind: "Cancelled",
    requestId: request.requestId,
    passengerId: request.passengerId,
    cancelledAt: now,
    reason,
  }),

  isCancellable: (request: TaxiRequest) =>
    request.kind === "Waiting" ||
    request.kind === "EnRoute" ||
    request.kind === "InTrip",
} as const;
```

### 注意点

**共通プロパティの扱い:** `requestId` や `passengerId` のように全状態に共通するプロパティがあっても、base type を `extends` で継承するのは避けてください。`interface` の継承は前述の declaration merging 問題を持ち込みます。各状態で明示的にプロパティを定義する冗長さは、型安全性とのトレードオフとして受け入れます。

**日時の生成:** 上記例では日時を引数として受け取る設計にしています。これによりテストで任意の時刻を注入でき、テスタビリティが確保されます。

## ドメインイベント

状態遷移に伴うビジネス上の出来事をドメインイベントとして記録します。

```typescript
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
  { driverId: DriverId; passengerId: PassengerId }
>;

type TripCompletedEvent = DomainEvent<
  "TripCompleted",
  { driverId: DriverId; duration: number }
>;
```

### 状態とイベントは同一トランザクションで永続化する

状態とイベントの両方を永続化する必要があるワークフローでは、同一のトランザクション境界で書き込みます。2 段に分けて書き込むと dual-write 問題を抱え、片方が成功してもう片方が失敗した瞬間に整合が壊れます。イベントだけを保存する処理に、この例に合わせるための状態の書き込みや resolver を追加する必要はありません。

```typescript
// Bad — 状態とイベントが別 tx。途中で落ちると整合が壊れる
saveRequest(entity).andThen(() => saveEvent(event));
```

状態更新と信頼性のあるイベント配送には **Outbox Pattern** を使います。状態テーブルへの UPDATE と outbox テーブルへの INSERT を同一 tx で行い、別プロセスが outbox 行をブローカーへリレーします。契約上もこの不可分性を表現します。`RequestResolver` と `RequestStore` はそれぞれ単一操作を公開し、両方が必要なオーケストレーションへ別々に注入します。別の検索や書き込みが必要になったら、これらを複数メソッドのインタフェースへ広げず、別の契約を定義します。

```typescript
type RequestResolver = Readonly<{
  findById: (id: RequestId) => Promise<TaxiRequest | undefined>;
}>;

type RequestStore = Readonly<{
  save: (
    state: EnRoute,
    events: readonly DriverAssignedEvent[],
  ) => Promise<void>;
}>;
```

一つの `save` メソッドにまとめることで、呼び出し側による二つの書き込みの調整を不要にします。ただし、型シグネチャだけでは原子性を保証できないため、アダプターがトランザクションを実装する必要があります。イベントを追記するだけの処理には、[domain-modeling.md](./domain-modeling.md#resolver-と-store-を操作ごとに分離する) の `TaskEventStore` のような単一メソッドのイベントストアを使えます。

### イベント生成の責務

純粋な判断関数とイベント生成関数が値を返し、ユースケースが入力の取得と、結果の状態・イベントを `RequestStore.save` へ渡す処理を組み立てます。業務イベントの生成を store のアダプターへ持ち込みません。時刻やイベント ID は値として渡し、純粋な関数の中で I/O や乱数生成を行いません。

```typescript
const buildDriverAssignedEvent =
  (now: Date, eventId: string) =>
  (enRoute: EnRoute): DriverAssignedEvent => ({
    eventId,
    eventAt: now,
    eventName: "DriverAssigned",
    payload: { driverId: enRoute.driverId, passengerId: enRoute.passengerId },
    aggregateId: enRoute.requestId,
    aggregateName: "TaxiRequest",
  });

type RequestNotFound = Readonly<{
  kind: "RequestNotFound";
  requestId: RequestId;
}>;

type InvalidState = Readonly<{
  kind: "InvalidState";
  requestId: RequestId;
}>;

type DriverNotAvailable = Readonly<{
  kind: "DriverNotAvailable";
  driverId: DriverId;
}>;

type AssignDriverDecisionError = InvalidState | DriverNotAvailable;
type AssignDriverError = RequestNotFound | AssignDriverDecisionError;

const assignDriver = (
  request: TaxiRequest,
  driverId: DriverId,
  isDriverAvailable: boolean,
  assignedAt: Date,
): Result<EnRoute, AssignDriverDecisionError> => {
  if (request.kind !== "Waiting") {
    return err({ kind: "InvalidState", requestId: request.requestId });
  }

  if (!isDriverAvailable) {
    return err({ kind: "DriverNotAvailable", driverId });
  }

  return ok(TaxiRequest.assignDriver(request, driverId, assignedAt));
};

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  async (
    requestId: RequestId,
    driverId: DriverId,
    isDriverAvailable: boolean,
    now: Date,
    eventId: string,
  ): Promise<Result<EnRoute, AssignDriverError>> => {
    const request = await requestResolver.findById(requestId);
    if (request === undefined) {
      return err({ kind: "RequestNotFound", requestId });
    }

    const assignment = assignDriver(request, driverId, isDriverAvailable, now);

    return assignment.match(
      async (enRoute) => {
        await requestStore.save(enRoute, [buildDriverAssignedEvent(now, eventId)(enRoute)]);
        return ok(enRoute);
      },
      err,
    );
  };
```

リゾルバがリクエストを見つけられない場合、ユースケースは `RequestNotFound` を返します。純粋な `assignDriver` の判断は、リクエストが `Waiting` でない場合に `InvalidState`、ドライバーを割り当てられない場合に `DriverNotAvailable` を返します。これらは `Result` で表す想定済みの業務結果です。一方、`findById` や `save` から予期せず reject された場合は、アプリケーションのエラー境界まで伝播させ、汎用的なリポジトリエラーに変換しません。

`now` と `eventId` は I/O の境界にいる呼び出し側が渡すため、テストで時刻と ID を固定できます。純粋な関数は clock、ID generator、resolver、store ではなく値を受け取ります。
