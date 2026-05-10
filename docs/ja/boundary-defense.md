# 境界防御の詳細ガイド

## TypeScriptの型の限界を理解する

TypeScriptの型はコンパイル時に消去される。ランタイムには型情報が残らないため、外部から入ってくるデータの正しさは型だけでは保証できない。

構造的部分型により、余分なプロパティを持つオブジェクトは少ないプロパティの型に代入できる。これが意図しないデータ漏洩の原因になる。

```typescript
type LogPayload = { id: string; role: string };
const user = { id: "1", role: "admin", email: "secret@example.com" };

// 型チェックは通るが、emailがログに含まれる
console.log(JSON.stringify(user satisfies LogPayload));
```

## スキーマベースのバリデーション

外部境界（APIリクエスト、DB結果、環境変数、ファイル読み込み）ではバリデーションライブラリのスキーマでパースする。

**バリデーションライブラリの検出:** プロジェクトの `package.json` の `dependencies` / `devDependencies` を確認し、該当するライブラリのガイドに従う。いずれも見つからない場合はユーザーに確認する。

- `zod` → [validation-libraries/zod.md](./validation-libraries/zod.md)
- `valibot` → [validation-libraries/valibot.md](./validation-libraries/valibot.md)
- `arktype` → [validation-libraries/arktype.md](./validation-libraries/arktype.md)

以下の例はZodの構文を使用。ValibotとArkTypeの等価な構文は上記のバリデーションライブラリガイドを参照。

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

`parse` は例外をスローする。Railway Oriented Programmingとの統合には `safeParse` を使い、結果をResult型に変換する。

```typescript
// safeParse の結果をプロジェクトで使用しているResult型ライブラリに変換する
const parseInput = (raw: unknown): Result<CreateRequestInput, ValidationError> => {
  const result = CreateRequestInput.safeParse(raw);
  if (result.success) return success(result.data);  // ok(), right(), createOk() 等
  return failure({ kind: "ValidationError", issues: result.error.issues });
};
```

### スキーマファクトリ: バリデーション → Result型の自動変換

上記のバリデーション → Result型変換は全スキーマで同じパターンになる。毎回手書きせず、プロジェクトで使用するResult型ライブラリに合わせたスキーマファクトリを1つ定義し、各スキーマの `parse` 関数を自動生成する。

これらのファクトリは [Standard Schema](https://github.com/standard-schema/standard-schema) インタフェース（`schema['~standard'].validate()`）を使用するため、Standard Schema準拠の**あらゆる**ライブラリ（Zod、Valibot、ArkType等）でそのまま動作する。

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

- スキーマごとにバリデーション → Result変換を手書きしない。ファクトリ関数を1つ定義してプロジェクト全体で再利用する
- ファクトリの戻り値の型は、使用するResult型ライブラリの型に統一する
- ファクトリはStandard Schemaを使用するため、Standard Schema準拠のバリデーションライブラリ（Zod、Valibot、ArkType）であれば同じファクトリが動作する
- companion objectパターンと組み合わせ、スキーマ定義と `parse` 関数をまとめて公開する:

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

`as` は型チェックをバイパスする。外部データにはスキーマバリデーション、内部データは型推論を信頼する。

```typescript
// Bad
const user = data as User;

// Good
const user = UserSchema.parse(data);
```

Branded Types についても、バリデーションライブラリのブランド機能を使えば `as` は不要になる。[バリデーションライブラリガイド](./validation-libraries/)で、Valibot/ArkTypeのBranded Types構文を参照。

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

バリデーションライブラリを使わないプロジェクトでは、Branded Types の生成関数内に限り `as` を許容する。

```typescript
const UserId = {
  of: (value: string): UserId => value as UserId, // Zod未使用時のみ許容
};
```

## Sensitive型によるPII防御

### 問題

TypeScriptの型はランタイムで消えるため、型で「PIIだ」とマークしても `JSON.stringify` や `console.log` で漏洩する。Branded Typeでも変数代入時にブランドが失われる。

### 解決策: クロージャベースのラッパー

値を関数クロージャに閉じ込め、シリアライズ時に自動マスクする。

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

パース時に自動でSensitiveラップする。以下はZodの例。ValibotとArkTypeの等価な構文は[バリデーションライブラリガイド](./validation-libraries/)を参照。

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

Sensitiveラッパーの適用漏れに備え、ロガーレベルでもredactionを設定する。

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

外部境界でバリデーション済みのデータは、ドメイン層内部で再度バリデーションしない。型を信頼する。

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
