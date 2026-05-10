---
name: functional-ts-ja
description: サーバーサイドTypeScriptでドメインモデル、ユースケース、リポジトリ、状態遷移、ビジネスロジックを書くときに使用する。Discriminated Union、純粋関数、Result型による関数型ドメインモデリングをガイドする。
license: MIT
---

# Functional Domain Modeling in TypeScript

サーバーサイドTypeScriptでドメインモデルを書くときの原則。classベースのOOPではなく、TypeScriptの型システムを最大限に活用した関数型アプローチを採る。

## 1. 型によるドメインモデリング

### Discriminated Unionで状態を表現する

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

### discriminantは `kind` で統一する

プロジェクト全体で `kind` をdiscriminantプロパティ名として統一する。`type`, `status`, `state` などが混在するとコードベースの一貫性が損なわれる。

### Companion Objectパターン

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

### `type` を使う（`interface` ではなく）

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

### 関数プロパティ記法を使う（メソッド記法ではなく）

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

### Branded Typesで意味を区別する

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

### `Readonly<>` で不変性を保証する

ドメインオブジェクトは `Readonly<>` で定義し、プロパティの再代入を防ぐ。状態変更は新しいオブジェクトの生成で表現する。

### ファイル構成: 1概念1ファイル

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

## 2. 関数による状態遷移

純粋関数で状態遷移を表現する。関数の引数型が有効な遷移元を制約し、戻り値型が遷移先を明示する。

```typescript
// assignDriver は Waiting 状態からのみ呼べる
const assignDriver = (waiting: Waiting, driverId: DriverId): EnRoute => ({
  kind: "EnRoute",
  passengerId: waiting.passengerId,
  driverId,
});
```

無効な遷移（例: `assignDriver(completed, driverId)`）はコンパイルエラーになる。ランタイムチェックは不要。

### 網羅性チェック

switch文では `assertNever` を使い、すべてのケースを処理していることをコンパイル時に保証する。新しい状態が追加されたとき、未処理の箇所がコンパイルエラーで検出される。

```typescript
const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
};

const describe = (request: TaxiRequest): string => {
  switch (request.kind) {
    case "Waiting": return "Waiting for driver";
    case "EnRoute": return `Driver ${request.driverId} en route`;
    case "InTrip": return "In trip";
    case "Completed": return "Completed";
    case "Cancelled": return "Cancelled";
    default: return assertNever(request);
  }
};
```

## 3. エラーハンドリング — Railway Oriented Programming

例外をスローせず、Result型でエラーを値として扱う。

**ライブラリの検出:** プロジェクトの `package.json` の `dependencies` / `devDependencies` を確認し、該当するライブラリのガイドに従う。いずれも見つからない場合はユーザーに確認する。

- `neverthrow` → [result-libraries/neverthrow.md](./result-libraries/neverthrow.md)
- `byethrow` → [result-libraries/byethrow.md](./result-libraries/byethrow.md)
- `fp-ts` → [result-libraries/fp-ts.md](./result-libraries/fp-ts.md)
- `option-t` → [result-libraries/option-t.md](./result-libraries/option-t.md)

エラー型はDiscriminated Unionで定義し、呼び出し元が網羅的にハンドルできるようにする。

```typescript
type AssignError =
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>
  | Readonly<{ kind: "RequestAlreadyAssigned" }>;
```

成功・失敗を型で表現し、チェーンで処理を合成する。各ライブラリのAPIについては上記のガイドを参照。

詳細: [error-handling.md](./error-handling.md)

## 4. 境界の防御

外部入力（APIリクエスト、DB結果、ファイル読み込み）はバリデーションライブラリのスキーマでランタイムバリデーションする。ドメイン層内部では型を信頼し、過剰な防御的バリデーションをしない。バリデーションライブラリ固有の構文は、Branded Typesセクションでリンクした[バリデーションライブラリガイド](./validation-libraries/)を参照。

```typescript
import { z } from "zod";

const CreateRequestSchema = z.object({
  passengerId: z.string().uuid().transform(PassengerId.of),
});

// API handler
const handler = (req: Request) => {
  const result = CreateRequestSchema.safeParse(req.body);
  if (!result.success) return badRequest(result.error);
  // result.data は型安全。以降 as は不要
};
```

### 型アサーション（`as`）を使わない

`as` は型チェックをバイパスし、ランタイムエラーの原因になる。外部データにはスキーマパース、内部データは型推論を信頼する。

### PIIの防御

個人情報を含むフィールドには `Sensitive<T>` ラッパーを適用し、`JSON.stringify` や `console.log` で自動的にマスクする。

```typescript
type Sensitive<T> = Readonly<{
  unwrap: () => T;
  toJSON: () => string;
  toString: () => string;
}>;

const Sensitive = {
  of: <T>(value: T): Sensitive<T> => ({
    unwrap: () => value,
    toJSON: () => "[REDACTED]",
    toString: () => "[REDACTED]",
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[REDACTED]",
  }),
} as const;
```

バリデーションスキーマで自動ラップする。以下はZodの例。ValibotとArkTypeの等価な構文は[バリデーションライブラリガイド](./validation-libraries/)を参照。

```typescript
const sensitiveString = z.string().transform(Sensitive.of);

const PatientSchema = z.object({
  name: sensitiveString,
  email: sensitiveString,
  role: z.string(), // PIIではないのでそのまま
});
```

詳細: [boundary-defense.md](./boundary-defense.md)

## 5. 宣言的なスタイル

### 配列操作

配列の変換は `filter` / `map` / `reduce` で宣言的に書く。述語関数はCompanion Objectに定義する。

```typescript
type Task = ActiveTask | CompletedTask;

const Task = {
  isActive: (task: Task): task is ActiveTask => task.kind === "Active",
} as const;

// 宣言的: 「何をしたいか」が明確
const activeTasks = tasks.filter(Task.isActive);

// 命令的: ループの中身を読まないと意図がわからない
const activeTasks: ActiveTask[] = [];
for (const task of tasks) {
  if (task.kind === "Active") activeTasks.push(task);
}
```

### ドメインイベント

状態変更に伴うドメインイベントは不変レコードとして生成し、リポジトリとは分離して記録する。

```typescript
type DomainEvent = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: string;
  payload: unknown;
  aggregateId: string;
}>;
```

詳細: [state-modeling.md](./state-modeling.md)

## 6. テストデータ

テストのダミーデータは `as const satisfies Type` で型安全に定義する。discriminantのリテラル型が保持され、wideningを防ぐ。

```typescript
const waitingRequest = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;

// waitingRequest.kind は "Waiting" リテラル型（string ではない）
```

## 原則の適用について

これらは推奨であり厳格なルールではない。コンテキストに応じて判断してよいが、原則から逸脱する場合はその理由をコメントで明示すること。

典型的な逸脱の正当理由:
- 外部ライブラリがclass継承を要求する場合
- パフォーマンス要件により不変データの生成コストが問題になる場合
- チームの合意により異なるパターンが採用されている場合
