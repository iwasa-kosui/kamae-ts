---
title: ArkType
parent: 境界の防御
grand_parent: 日本語
nav_order: 3
---

# ArkType

## 基本API

```typescript
import { type } from "arktype";
```

| 関数/型 | 説明 |
|---------|------|
| `type({...})` | オブジェクト型定義 |
| `type("string")` | 文字列型 |
| `type("number")` | 数値型 |
| `typeof Schema.infer` | 型定義から TypeScript 型を抽出 |
| `schema(raw)` | バリデーション済みデータまたは `type.errors` を返す |
| `schema.assert(raw)` | バリデーション済みデータを返すかスロー |
| `.brand("Name")` | 出力型に nominal ブランドを付与 |
| `.pipe(fn)` | バリデーション済みの値を変換（morph） |
| `"string.uuid"` | UUID 形式バリデーション |
| `"string.email"` | メール形式バリデーション |

## スキーマ定義

```typescript
const CreateRequestInput = type({
  passengerId: "string.uuid",
  pickupLocation: {
    lat: "number >= -90 & number <= 90",
    lng: "number >= -180 & number <= 180",
  },
});

type CreateRequestInput = typeof CreateRequestInput.infer;
```

## Branded Types

`.brand()` でブランドを定義します。バリデーション済みの出力に自動的にブランドが付与されます。

```typescript
const UserIdSchema = type("string.uuid").brand("UserId");
type UserId = typeof UserIdSchema.infer;

const ProductIdSchema = type("string.uuid").brand("ProductId");
type ProductId = typeof ProductIdSchema.infer;

// バリデーション済み出力は既にブランド付き — `as` キャスト不要
```

### Companion Objectパターン

```typescript
const RequestIdSchema = type("string.uuid").brand("RequestId");
type RequestId = typeof RequestIdSchema.infer;

const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema), // schemaResult は boundary-defense.md を参照
} as const;
```

## Sensitive型との統合

`.pipe()` を使用してバリデーション時に PII フィールドを自動ラップします。

```typescript
const sensitiveString = type("string").pipe(Sensitive.of);

const PatientSchema = type({
  id: "string.uuid",
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: "string", // PIIではないのでそのまま
});
```

## バリデーション結果のハンドリング

ArkType はバリデーション済みデータを直接返すか、失敗時に `ArkErrors` インスタンスを返します。`instanceof type.errors` で判別します。

```typescript
const result = CreateRequestInput(rawData);
if (result instanceof type.errors) {
  // result は ArkErrors — ArkError オブジェクトの配列
  console.error(result.summary);
} else {
  // result は CreateRequestInput — バリデーション済みデータ
  console.log(result);
}
```

## ガイドライン

- ArkType はコールベースの API（`schema(data)`）を使い、`safeParse` の代わりに `instanceof type.errors` で失敗を判定します
- [boundary-defense.md](../boundary-defense.md) のスキーマファクトリーは Standard Schema インタフェースを使用するため、ArkType でもそのまま動作します
- ArkType の型構文は TypeScript 構文を模倣（例: `"string | number"`、`"string[]"`）しており、学習コストが低いです
- ランタイムパフォーマンスとバンドルサイズの両面で最適化されており、エッジ環境に適しています
- `.brand()` により Branded Types で `as` キャストが不要になります
