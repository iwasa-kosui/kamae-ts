# 型によるドメインモデリング 詳細ガイド

## Discriminated Unionで状態を表現する

ドメインエンティティの状態はclassではなくDiscriminated Unionで定義する。各状態を個別の型として定義し、状態固有のプロパティを必須にする。

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

**理由:** optional プロパティは「どの状態でどのプロパティが存在するか」をコンパイル時に保証できない。Discriminated Unionなら、switch文でkindを判別した時点で状態固有のプロパティに安全にアクセスできる。

## discriminantは `kind` で統一する

プロジェクト全体で `kind` をdiscriminantプロパティ名として統一する。`type`, `status`, `state` などが混在するとコードベースの一貫性が損なわれる。

## Companion Objectパターン

型定義と関連する関数を同名のオブジェクトにまとめる。Branded Types のバリデーションスキーマは、スタンドアロンの export ではなく companion object の `schema` プロパティとして公開する。

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

  isActive: (request: TaxiRequest): request is Waiting | EnRoute | InTrip =>
    request.kind !== "Completed" && request.kind !== "Cancelled",
} as const;
```

## `type` を使う（`interface` ではなく）

ドメイン型は `type` で定義する。`interface` のdeclaration mergingは、別ファイルで同名のinterfaceを宣言するだけで型の形状が暗黙的に変わる危険がある。

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

型定義内の関数はメソッド記法ではなく関数プロパティ記法で書く。メソッド記法はパラメータ型がbivariantになり、型安全性が崩れる。

```typescript
// Good: 関数プロパティ記法 — パラメータはcontravariant
type TaskRepository = {
  save: (task: Task) => Promise<void>;
  findById: (id: TaskId) => Promise<Task | undefined>;
};

// Bad: メソッド記法 — パラメータがbivariantになり、
// save(task: DoingTask) のような狭い実装が型チェックを通過してしまう
type TaskRepository = {
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | undefined>;
};
```

## Branded Typesで意味を区別する

構造的部分型により `string` 同士は互換になる。意味の異なるIDや値にはBranded Typeを適用する。

**バリデーションライブラリの検出:** プロジェクトの `package.json` の `dependencies` / `devDependencies` を確認し、該当するライブラリのガイドに従う。いずれも見つからない場合はユーザーに確認する。

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

バリデーションライブラリを使っている場合は、そのブランド機能で定義する。スキーマの出力型が自動的にブランド付きになるため、`as` キャストが不要になる。以下はZodの例:

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

バリデーションライブラリを使わないプロジェクトでは `unique symbol` パターンを使う。

```typescript
export const UserIdBrand = Symbol();
type UserId = string & { readonly [typeof UserIdBrand]: never };

export const ProductIdBrand = Symbol();
type ProductId = string & { readonly [typeof ProductIdBrand]: never };
```

## `Readonly<>` で不変性を保証する

ドメインオブジェクトは `Readonly<>` で定義し、プロパティの再代入を防ぐ。状態変更は新しいオブジェクトの生成で表現する。

## ファイル構成: 1概念1ファイル

各ドメイン概念（型 + companion object）は専用のファイルに配置する。`types.ts` や `models.ts` のような catch-all ファイルは禁止。型と振る舞いが分離し、循環依存の原因になる。

```
// ❌ types.ts に型を集約、companion は別ファイル
// types.ts — ItemId, ItemType, Status, Priority, Item, Config, ...
// item-id.ts — ItemId の companion object（types.ts から型を import）

// ✅ 概念ごとにファイルを分割
// item-id.ts — type ItemId + const ItemId (companion)
// item-type.ts — type ItemType + const ItemType (companion)
// status.ts — type Status + const Status (companion)
```

barrel file（`index.ts`）は re-export のみに使い、型や関数を直接定義しない。
