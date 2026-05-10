---
title: 境界の防御
parent: 日本語
nav_order: 4
has_children: true
---

# 境界防御の詳細ガイド

## TypeScriptの型の限界を理解する

TypeScript の型はコンパイル時に消去されます。ランタイムには型情報が残らないため、外部から入ってくるデータの正しさは型だけでは保証できません。

構造的部分型により、余分なプロパティを持つオブジェクトは少ないプロパティの型に代入できてしまいます。これが意図しないデータ漏洩の原因になります。

```typescript
type LogPayload = { id: string; role: string };
const user = { id: "1", role: "admin", email: "secret@example.com" };

// 型チェックは通るが、emailがログに含まれる
console.log(JSON.stringify(user satisfies LogPayload));
```

## スキーマベースのバリデーション

外部境界（API リクエスト、DB 結果、環境変数、ファイル読み込み）ではバリデーションライブラリのスキーマでパースします。

**バリデーションライブラリの検出:** プロジェクトの `package.json` の `dependencies` / `devDependencies` を確認し、該当するライブラリのガイドに従ってください。いずれも見つからない場合はユーザーに確認します。

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

以下の例は Zod の構文を使用しています。Valibot と ArkType の等価な構文は上記のバリデーションライブラリガイドを参照してください。

```typescript
import { z } from "zod";

const CreateRequestInput = z.object({
  passengerId: z.string().uuid(),
  pickupLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

type CreateRequestInput = z.infer<typeof CreateRequestInput>;
```

### `safeParse` を使う

`parse` は例外をスローします。Railway Oriented Programming との統合には `safeParse` を使い、結果を Result 型に変換します。

```typescript
// safeParse の結果をプロジェクトで使用しているResult型ライブラリに変換する
const parseInput = (raw: unknown): Result<CreateRequestInput, ValidationError> => {
  const result = CreateRequestInput.safeParse(raw);
  if (result.success) return success(result.data);  // ok(), right(), createOk() 等
  return failure({ kind: "ValidationError", issues: result.error.issues });
};
```

### スキーマファクトリ: バリデーション → Result型の自動変換

上記のバリデーション → Result 型変換は全スキーマで同じパターンになります。毎回手書きせず、プロジェクトで使用する Result 型ライブラリに合わせたスキーマファクトリを 1 つ定義し、各スキーマの `parse` 関数を自動生成します。

これらのファクトリは [Standard Schema](https://github.com/standard-schema/standard-schema) インタフェース（`schema['~standard'].validate()`）を使用するため、Standard Schema 準拠の**あらゆる**ライブラリ（Zod、Valibot、ArkType 等）でそのまま動作します。

#### neverthrow の場合

```typescript
import { ok, err, Result } from "neverthrow";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return err({ kind: "ValidationError", issues: result.issues });
    return ok(result.value);
  };

// 使用例 — Zod、Valibot、ArkType、またはStandard Schema準拠の任意のライブラリで動作
const parseCreateRequestInput = schemaResult(CreateRequestInput);
const parseRequestId = schemaResult(RequestIdSchema);

// parse: (raw: unknown) => Result<CreateRequestInput, ValidationError>
const result = parseCreateRequestInput(rawBody);
```

#### fp-ts の場合

```typescript
import * as E from "fp-ts/Either";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaEither = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): E.Either<ValidationError, T> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return E.left({ kind: "ValidationError", issues: result.issues });
    return E.right(result.value);
  };
```

#### option-t の場合

```typescript
import { createOk, createErr, type Result } from "option-t/plain_result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return createErr({ kind: "ValidationError", issues: result.issues });
    return createOk(result.value);
  };
```

#### byethrow の場合

```typescript
import { Result } from "@praha/byethrow";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
}>;

const schemaResult = <T>(schema: StandardSchemaV1<unknown, T>) =>
  (raw: unknown): Result.Result<T, ValidationError> => {
    const result = schema["~standard"].validate(raw);
    if (result instanceof Promise) throw new TypeError("Schema validation must be synchronous");
    if (result.issues) return Result.fail({ kind: "ValidationError", issues: result.issues });
    return Result.succeed(result.value);
  };
```

#### ガイドライン

- スキーマごとにバリデーション → Result 変換を手書きしないでください。ファクトリ関数を 1 つ定義してプロジェクト全体で再利用します
- ファクトリの戻り値の型は、使用する Result 型ライブラリの型に統一します
- ファクトリは Standard Schema を使用するため、Standard Schema 準拠のバリデーションライブラリ（Zod、Valibot、ArkType）であれば同じファクトリが動作します
- companion object パターンと組み合わせ、スキーマ定義と `parse` 関数をまとめて公開します。

```typescript
// Standard Schema準拠のバリデーションライブラリであれば動作する
const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema),
} as const;

// 使用側
const id = RequestId.parse(raw); // Result<RequestId, ValidationError>
```

## 型アサーション（`as`）の禁止

`as` は型チェックをバイパスします。許容するのは `as const` と `as const satisfies Type` のみで、それ以外の `as` はすべて禁止します。

コンパイラから見て型が不明な値（外部入力、生データ、ランタイムで形が決まるオブジェクト）に出会ったら、答えは**常にバリデーションライブラリのスキーマでパースすること**です。`as` は型が主張する保証を実体としては与えません。パースだけが与えます。

```typescript
// ❌ as はバリデーションをバイパスする — データが一致しなければ型は嘘
const user = data as User;

// ✅ スキーマパースで本物の User が得られる
const user = UserSchema.parse(data);
```

Branded Types についても、バリデーションライブラリのブランド機能を使えば `as` は不要になります。[バリデーションライブラリガイド](./validation-libraries/)で、Valibot/ArkType の Branded Types 構文を参照してください。

```typescript
// ❌ 手動ブランド + as キャスト
type ItemId = string & { readonly __brand: unique symbol };
const ItemIdSchema = z.string().regex(/^item-\d+$/);
const parse = (raw: string): ItemId => ItemIdSchema.parse(raw) as ItemId;

// ✅ z.brand() — as 不要（Zodの例）
export const ItemIdBrand = Symbol();
const ItemIdSchema = z.string().regex(/^item-\d+$/).brand<typeof ItemIdBrand>();
type ItemId = z.infer<typeof ItemIdSchema>;
const parse = (raw: string): ItemId => ItemIdSchema.parse(raw); // 既に ItemId 型
```

### 最後の手段としての例外: `unique symbol` Branded Type の生成関数

バリデーションライブラリをまだ導入していないプロジェクトでは、検証済みの値をブランドする Branded Type の生成関数内**でのみ** `as` を使ってかまいません。これは恒久的な選択肢ではなく、バリデーションライブラリ導入と同時に解消すべき暫定措置として扱ってください。

```typescript
const UserId = {
  of: (value: string): UserId => value as UserId, // バリデーションライブラリ未導入時のみ許容
};
```

このフォールバックを使っているプロジェクトに遭遇したら、`as` を残すのではなく、バリデーションライブラリを導入して `z.brand()` / `v.brand()` / `.brand()` でブランドを書き換えることを優先してください。

## Sensitive型によるPII防御

### 問題

TypeScript の型はランタイムで消えるため、型で「PII だ」とマークしても `JSON.stringify` や `console.log` で漏洩します。Branded Type でも変数代入時にブランドが失われます。

### 解決策: クロージャベースのラッパー

値を関数クロージャに閉じ込め、シリアライズ時に自動マスクします。

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

### バリデーションライブラリとの統合

パース時に自動で Sensitive ラップします。以下は Zod の例です。Valibot と ArkType の等価な構文は[バリデーションライブラリガイド](./validation-libraries/)を参照してください。

```typescript
const sensitiveString = z.string().transform(Sensitive.of);

const PatientSchema = z.object({
  id: z.string().uuid(),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: z.string(), // PIIではない
});

const patient = PatientSchema.parse(rawData);
console.log(JSON.stringify(patient));
// {"id":"...","name":"[REDACTED]","email":"[REDACTED]","diagnosis":"[REDACTED]","role":"doctor"}
```

### 多層防御: Pinoのredaction

Sensitive ラッパーの適用漏れに備え、ロガーレベルでも redaction を設定します。

```typescript
import pino from "pino";

const logger = pino({
  redact: {
    paths: ["email", "*.email", "password", "*.password", "name", "*.name"],
    censor: "[REDACTED]",
  },
});
```

## ドメイン内部では過剰防御しない

外部境界でバリデーション済みのデータは、ドメイン層内部で再度バリデーションしません。型を信頼します。

```typescript
// Bad: ドメイン層で冗長なチェック
const assignDriver = (waiting: Waiting, driverId: DriverId): EnRoute => {
  if (waiting.kind !== "Waiting") throw new Error("Invalid state"); // 型が保証している
  if (!driverId) throw new Error("Missing driverId"); // 型が保証している
  return { kind: "EnRoute", passengerId: waiting.passengerId, driverId };
};

// Good: 型を信頼する
const assignDriver = (waiting: Waiting, driverId: DriverId): EnRoute => ({
  kind: "EnRoute",
  passengerId: waiting.passengerId,
  driverId,
});
```
