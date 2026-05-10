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

状態遷移に伴うビジネス上の出来事をドメインイベントとして記録する。イベントはリポジトリとは別のストアに保存する。

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

### イベント生成の責務

ユースケース層がイベントを生成し、リポジトリにはエンティティとイベントを別々に渡す。リポジトリがイベントを生成する設計は責務が肥大化する。

```typescript
const assignDriverUseCase = (
  requestId: RequestId,
  driverId: DriverId,
) =>
  findRequest(requestId)
    .andThen(validateWaiting)
    .map((waiting) => {
      const enRoute = TaxiRequest.assignDriver(waiting, driverId);
      const event: DriverAssignedEvent = {
        eventId: crypto.randomUUID(),
        eventAt: new Date(),
        eventName: "DriverAssigned",
        payload: { driverId, passengerId: waiting.passengerId },
        aggregateId: waiting.requestId,
        aggregateName: "TaxiRequest",
      };
      return { entity: enRoute, event };
    })
    .andThen(({ entity, event }) =>
      saveRequest(entity).andThen(() => saveEvent(event))
    );
```
