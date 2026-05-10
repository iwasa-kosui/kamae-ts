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
| `v.InferOutput<typeof Schema>` | スキーマからTypeScript出力型を抽出 |
| `v.safeParse(schema, raw)` | 例外をスローせず `{ success, output, issues }` を返す |
| `v.parse(schema, raw)` | パース済みデータを返すか `ValiError` をスロー |
| `v.brand("Name")` | nominalブランドを付与（`pipe` 内で使用） |
| `v.transform(fn)` | パース済みの値を変換（`pipe` 内で使用） |
| `v.uuid()` | UUID形式バリデーション（`pipe` 内で使用） |

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

`v.pipe()` 内で `v.brand()` を使いブランドを定義する。スキーマの出力型に自動的にブランドが付与される。

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

`v.pipe()` 内で `v.transform()` を使用し、パース時にPIIフィールドを自動ラップする。

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

- Railway Oriented Programmingとの統合には `v.parse` より `v.safeParse` を使う（スキーマファクトリーパターンは [boundary-defense.md](../boundary-defense.md) を参照）
- boundary-defense.md のスキーマファクトリーは Standard Schema 準拠のため、Valibotでもそのまま動作する
- Valibotはツリーシェイキング対応でZodより大幅に軽量なため、エッジ環境（Cloudflare Workers等）に最適
- `v.brand()` により Branded Types で `as` キャストが不要になる
