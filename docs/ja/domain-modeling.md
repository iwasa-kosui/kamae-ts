---
title: 型によるドメインモデリング
parent: 日本語
nav_order: 1
---

# 型によるドメインモデリング 詳細ガイド

## Discriminated Unionで状態を表現する

ドメインエンティティの状態は class ではなく Discriminated Union で定義します。各状態を個別の型として定義し、状態固有のプロパティを必須にします。

```typescript
// Good: 各状態が独立した型。状態固有のプロパティが必須
type Waiting = Readonly<{
  kind: "Waiting";
  passengerId: PassengerId;
}>;

type EnRoute = Readonly<{
  kind: "EnRoute";
  passengerId: PassengerId;
  driverId: DriverId;
}>;

type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;
```

```typescript
// Bad: optional プロパティで全状態を1つの型に押し込む
type TaxiRequest = {
  state: string;
  passengerId: string;
  driverId?: string;    // どの状態で存在するか不明
  startTime?: Date;     // null チェックが至る所で必要
  endTime?: Date;
};
```

**理由:** optional プロパティは「どの状態でどのプロパティが存在するか」をコンパイル時に保証できません。Discriminated Union なら、switch 文で kind を判別した時点で状態固有のプロパティに安全にアクセスできます。

## discriminantは `kind` で統一する

プロジェクト全体で `kind` を discriminant プロパティ名として統一します。`type`、`status`、`state` などが混在するとコードベースの一貫性が損なわれます。

## Companion Objectパターン

型定義と関連する関数を同名のオブジェクトにまとめます。Branded Types のバリデーションスキーマは、スタンドアロンの export ではなく companion object の `schema` プロパティとして公開します。

```typescript
// ❌ スキーマを単独 export — 実装詳細の漏洩
export const ItemIdBrand = Symbol();
export const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();

// ✅ companion object が schema を所有する
const ItemIdBrand = Symbol();
const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();
export type ItemId = z.infer<typeof ItemIdSchema>;

export const ItemId = {
  schema: ItemIdSchema,
  parse: (raw: string) => ItemIdSchema.safeParse(raw),
} as const;
```

```typescript
type TaxiRequest = Waiting | EnRoute | InTrip | Completed | Cancelled;

const TaxiRequest = {
  assignDriver: (waiting: Waiting, driverId: DriverId): EnRoute => ({
    kind: "EnRoute",
    passengerId: waiting.passengerId,
    driverId,
  }),

  startTrip: (enRoute: EnRoute, startTime: Date): InTrip => ({
    kind: "InTrip",
    passengerId: enRoute.passengerId,
    driverId: enRoute.driverId,
    startTime,
  }),

  isActive: (request: TaxiRequest) =>
    request.kind !== "Completed" && request.kind !== "Cancelled",
} as const;
```

## `type` を使う（`interface` ではなく）

ドメイン型は `type` で定義します。`interface` の declaration merging は、別ファイルで同名の interface を宣言するだけで型の形状が暗黙的に変わる危険があります。

```typescript
// Good
type User = Readonly<{
  id: UserId;
  name: string;
}>;

// Bad: 別ファイルで interface User { hashedPassword?: string } と宣言されると
// 気づかないうちに型が変わる
interface User {
  id: string;
  name: string;
}
```

## 関数プロパティ記法を使う（メソッド記法ではなく）

型定義内の関数はメソッド記法ではなく関数プロパティ記法で書きます。メソッド記法はパラメータ型が bivariant になり、型安全性が崩れます。

```typescript
// Good: 関数プロパティ記法 — パラメータはcontravariant
type TaskStore = {
  save: (task: Task) => Promise<void>;
};

// Bad: メソッド記法 — パラメータがbivariantになり、
// save(task: DoingTask) のような狭い実装が型チェックを通過してしまう
type TaskStore = {
  save(task: Task): Promise<void>;
};
```

## Branded Typesで意味を区別する

構造的部分型により `string` 同士は互換になります。意味の異なる ID や値には Branded Type を適用します。

**バリデーションライブラリの検出:** プロジェクトの `package.json` の `dependencies` / `devDependencies` を確認し、該当するライブラリのガイドに従ってください。いずれも見つからない場合はユーザーに確認します。

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

バリデーションライブラリを使っている場合は、そのブランド機能で定義します。スキーマの出力型が自動的にブランド付きになるため、`as` キャストが不要になります。以下は Zod の例です。

```typescript
import { z } from "zod";

export const UserIdBrand = Symbol();
const UserIdSchema = z.string().uuid().brand<typeof UserIdBrand>();
type UserId = z.infer<typeof UserIdSchema>;

export const ProductIdBrand = Symbol();
const ProductIdSchema = z.string().uuid().brand<typeof ProductIdBrand>();
type ProductId = z.infer<typeof ProductIdSchema>;

// safeParse().data は既にブランド付き — as 不要
```

バリデーションライブラリを使わないプロジェクトでは `unique symbol` パターンを使います。

```typescript
export const UserIdBrand = Symbol();
type UserId = string & { readonly [typeof UserIdBrand]: never };

export const ProductIdBrand = Symbol();
type ProductId = string & { readonly [typeof ProductIdBrand]: never };
```

## `Readonly<>` で不変性を保証する

ドメインオブジェクトは `Readonly<>` で定義し、プロパティの再代入を防ぎます。状態変更は新しいオブジェクトの生成で表現します。

## ファイル構成: 1概念1ファイル

各ドメイン概念（型 + companion object）は専用のファイルに配置します。`types.ts` や `models.ts` のような catch-all ファイルは禁止です。型と振る舞いが分離し、循環依存の原因になります。

```
// ❌ types.ts に型を集約、companion は別ファイル
// types.ts — ItemId, ItemType, Status, Priority, Item, Config, ...
// item-id.ts — ItemId の companion object（types.ts から型を import）

// ✅ 概念ごとにファイルを分割
// item-id.ts — type ItemId + const ItemId (companion)
// item-type.ts — type ItemType + const ItemType (companion)
// status.ts — type Status + const Status (companion)
```

barrel file（`index.ts`）は re-export のみに使い、型や関数を直接定義しないでください。

## resolver と store を操作ごとに分離する

読み取りの契約（resolver）と書き込みの契約（store）を分離します。それぞれ原則として単一メソッドとし、利用側が必要とする操作に合わせて名前と型を定義します。エンティティ単位の repository を出発点にしたり、CRUD を揃えるためにメソッドを追加したりしません。複数メソッドの reader と writer に分けるだけで終わらず、独立した検索や書き込みも別々の契約にします。

```typescript
type TaskByIdResolver = Readonly<{
  findById: (id: TaskId) => Promise<Task | undefined>;
}>;

type TasksByAssigneeResolver = Readonly<{
  findByAssignee: (assigneeId: UserId) => Promise<readonly Task[]>;
}>;

type TaskStore = Readonly<{
  save: (task: Task) => Promise<void>;
}>;

type TaskEventStore = Readonly<{
  append: (events: readonly TaskEvent[]) => Promise<void>;
}>;
```

各契約はそれぞれの概念のファイルに配置します。イベントを追記するだけの利用側には `TaskEventStore` だけを渡し、resolver や状態の store を要求しません。タスクを取得して更新状態を保存する利用側には、`TaskByIdResolver` と `TaskStore` を別々に渡します。`findById`、`resolve`、`save`、`append` は、必要な操作を表していればいずれも有効な名前です。問題にするのは特定のメソッド名ではなく、契約が引き受ける責務の範囲です。

I/O はワークフローの両端に置きます。必要な入力を取得し、その値を純粋な判断処理へ渡し、返された状態やイベントを保存します。時刻や生成済みの ID も値として渡します。I/O のインタフェースを DI しても、その関数が純粋になるわけではありません。判断結果によって次の I/O が決まる場合は、オーケストレーションが I/O と純粋な処理を明示的に交互に実行します。この構造は Scott Wlaschin の [dependency rejection](https://fsharpforfunandprofit.com/posts/dependencies/#approach-2-dependency-rejection) を参照してください。

composition root で複数の契約を組み立てたり、アダプター間で DB クライアントやトランザクションを共有したりして構いません。各利用側には必要な契約だけを渡し、広い repository や service locator にまとめ直しません。状態とイベントの原子的な保存は一つの操作なので、一つの store メソッドにまとめます。詳細は [state-modeling.md](./state-modeling.md#状態とイベントは同一トランザクションで永続化する) を参照してください。既存の広い契約を使う明示的なプロジェクト要件がある場合は、その要件を尊重してトレードオフを説明し、慣習だけで不要な操作を追加しません。

## ポートは domain 層に配置する

ポートは、ドメインやユースケースが必要とする依存先の契約です。resolver、store、clock、ID generator などが該当します。契約を所有するのは domain 層です。既存の domain 内の構成と「1概念1ファイル」に従い、対象のドメイン概念のそばに配置します。「ポート」という呼び名のために別の層を設けず、トップレベル、`application/` 配下、`domain/` 配下のいずれにも専用の `port/` や `ports/` ディレクトリを作りません。

ドメイン概念ごとにディレクトリを分ける構成の例です。

```text
src/
  domain/task/
    task.ts
    task-id.ts
    task-by-id-resolver.ts   # One read operation, expressed in domain types
    task-store.ts            # One write operation, expressed in domain types
  application/
    complete-task.ts         # Receives the resolver and store separately
  infrastructure/
    postgres-task-by-id-resolver.ts  # Implements the read contract
    postgres-task-store.ts          # Implements the write contract
  main.ts                   # Wires the adapter into the use case
```

domain 内をフラットに構成している場合は `src/domain/task-store.ts` とします。`src/ports/task-store.ts` や `src/domain/ports/task-store.ts` のような汎用的な置き場に集めず、それぞれの契約を所有する概念のそばに置きます。

ユースケースと具体的なアダプターは、domain 層から契約を import します。契約にはドメイン型を使い、アダプター、DB クライアント、外部 SDK の型を import しません。具体的な I/O と外部データの変換は infrastructure 層のアダプターに置き、composition root でユースケースへ実装を注入します。domain 層で契約を定義しても、純粋な状態遷移関数で I/O を実行するわけではありません。注入された依存先の呼び出しはユースケースが担当します。
