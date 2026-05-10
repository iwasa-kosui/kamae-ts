---
title: Valibot
parent: 境界の防御
grand_parent: 日本語
nav_order: 2
---

# Valibot

## 基本API

```typescript
import * as v from "valibot";
```

| 関数/型 | 説明 |
|---------|------|
| `v.object({...})` | オブジェクトスキーマ |
| `v.string()` | 文字列スキーマ |
| `v.number()` | 数値スキーマ |
| `v.pipe(schema, ...actions)` | バリデーション・変換のチェーン |
| `v.InferOutput<typeof Schema>` | スキーマから TypeScript 出力型を抽出 |
| `v.safeParse(schema, raw)` | 例外をスローせず `{ success, output, issues }` を返す |
| `v.parse(schema, raw)` | パース済みデータを返すか `ValiError` をスロー |
| `v.brand("Name")` | nominal ブランドを付与（`pipe` 内で使用） |
| `v.transform(fn)` | パース済みの値を変換（`pipe` 内で使用） |
| `v.uuid()` | UUID 形式バリデーション（`pipe` 内で使用） |

## スキーマ定義

```typescript
const CreateRequestInput = v.object({
  passengerId: v.pipe(v.string(), v.uuid()),
  pickupLocation: v.object({
    lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  }),
});

type CreateRequestInput = v.InferOutput<typeof CreateRequestInput>;
```

## Branded Types

`v.pipe()` 内で `v.brand()` を使いブランドを定義します。スキーマの出力型に自動的にブランドが付与されます。

```typescript
const UserIdSchema = v.pipe(v.string(), v.uuid(), v.brand("UserId"));
type UserId = v.InferOutput<typeof UserIdSchema>;

const ProductIdSchema = v.pipe(v.string(), v.uuid(), v.brand("ProductId"));
type ProductId = v.InferOutput<typeof ProductIdSchema>;

// v.parse() の出力は既にブランド付き — `as` キャスト不要
```

### Companion Objectパターン

```typescript
const RequestIdSchema = v.pipe(v.string(), v.uuid(), v.brand("RequestId"));
type RequestId = v.InferOutput<typeof RequestIdSchema>;

const RequestId = {
  schema: RequestIdSchema,
  parse: schemaResult(RequestIdSchema), // schemaResult は boundary-defense.md を参照
} as const;
```

## Sensitive型との統合

`v.pipe()` 内で `v.transform()` を使用し、パース時に PII フィールドを自動ラップします。

```typescript
const sensitiveString = v.pipe(v.string(), v.transform(Sensitive.of));

const PatientSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: sensitiveString,
  email: sensitiveString,
  diagnosis: sensitiveString,
  role: v.string(), // PIIではないのでそのまま
});
```

## ガイドライン

- Railway Oriented Programming との統合には `v.parse` より `v.safeParse` を使ってください（スキーマファクトリーパターンは [boundary-defense.md](../boundary-defense.md) を参照）
- boundary-defense.md のスキーマファクトリーは Standard Schema 準拠のため、Valibot でもそのまま動作します
- Valibot はツリーシェイキング対応で Zod より大幅に軽量なため、エッジ環境（Cloudflare Workers 等）に最適です
- `v.brand()` により Branded Types で `as` キャストが不要になります
