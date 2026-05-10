---
title: 関数による状態遷移
parent: 日本語
nav_order: 2
---

# 状態モデリング詳細ガイド

## Discriminated Unionによる状態遷移の設計

### 設計手順

1. ドメインエンティティが取りうる状態を列挙する
2. 各状態で必要なプロパティを特定する
3. 状態ごとに個別の型を定義する（`kind` をdiscriminant）
4. Union型でまとめる
5. 有効な遷移を純粋関数として定義する
6. Companion Objectに関数をまとめる

### 状態遷移図からコードへ

```
Waiting → EnRoute → InTrip → Completed
  ↓         ↓        ↓
Cancelled Cancelled Cancelled
```

この遷移図は以下のように型と関数に変換される。

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

  isCancellable: (request: TaxiRequest): request is CancellableRequest =>
    request.kind === "Waiting" ||
    request.kind === "EnRoute" ||
    request.kind === "InTrip",
} as const;
```

### 注意点

**共通プロパティの扱い:** `requestId` や `passengerId` のように全状態に共通するプロパティがあっても、base typeを `extends` で継承するのは避ける。`interface` の継承は前述のdeclaration merging問題を持ち込む。各状態で明示的にプロパティを定義する冗長さは、型安全性とのトレードオフとして受け入れる。

**日時の生成:** 上記例では日時を引数として受け取る設計にしている。これによりテストで任意の時刻を注入でき、テスタビリティが確保される。

## ドメインイベント

状態遷移に伴うビジネス上の出来事をドメインイベントとして記録する。

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

集約の状態とそれが発行するイベントは、必ず同一のトランザクション境界で永続化する。別ストアに分けて 2 段で書き込む素朴な実装は dual-write 問題を抱え、片方が成功してもう片方が失敗した瞬間に整合が壊れる。

```typescript
// Bad — 状態とイベントが別 tx。途中で落ちると整合が壊れる
saveRequest(entity).andThen(() => saveEvent(event));
```

標準的な実装は **Outbox Pattern**: 状態テーブルへの UPDATE と outbox テーブルへの INSERT を同一 tx で行い、別プロセスが outbox 行をブローカーへリレーする。インタフェース上もこの不可分性を表現する。参照系（リード）は `RequestResolver` として書き込み系から切り出す（ISP）。

```typescript
type RequestResolver = Readonly<{
  findById: (id: RequestId) => ResultAsync<Waiting | undefined, RepositoryError>;
}>;

type RequestStore = Readonly<{
  save: (
    state: EnRoute,
    events: readonly DriverAssignedEvent[],
  ) => ResultAsync<void, RepositoryError>;
}>;
```

`save` を 1 メソッドに閉じることで、呼び出し側が「状態は更新したがイベントは飛ばなかった」中途半端な状態を構造的に作れなくする。

### イベント生成の責務

ユースケース層がイベントを生成し、`RequestStore.save` に状態と一緒に渡す。リポジトリがイベントを内部で生成する設計は、永続化と業務ルールが混ざって責務が肥大化する。

```typescript
const buildDriverAssignedEvent =
  (now: Date) =>
  (enRoute: EnRoute): DriverAssignedEvent => ({
    eventId: crypto.randomUUID(),
    eventAt: now,
    eventName: "DriverAssigned",
    payload: { driverId: enRoute.driverId, passengerId: enRoute.passengerId },
    aggregateId: enRoute.requestId,
    aggregateName: "TaxiRequest",
  });

const assignDriverUseCase =
  (requestResolver: RequestResolver, requestStore: RequestStore) =>
  (requestId: RequestId, driverId: DriverId, now: Date) =>
    requestResolver
      .findById(requestId)
      .andThen(validateWaiting)
      .map(transitionToEnRoute(driverId))
      .andThrough((enRoute) =>
        requestStore.save(enRoute, [buildDriverAssignedEvent(now)(enRoute)]),
      );
```

`now` はユースケースの引数として外部から注入する。`new Date()` をユースケース内で呼ばないことで、テスト時に任意の時刻を注入できる。
