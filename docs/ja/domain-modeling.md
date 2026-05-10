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
