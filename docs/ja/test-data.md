# テストデータガイド

## `as const satisfies` で型安全なテストフィクスチャを定義する

テストのダミーデータは `as const satisfies Type` で型安全に定義する。discriminantのリテラル型が保持され、wideningを防ぐ。

```typescript
const waitingRequest = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;

// waitingRequest.kind は "Waiting" リテラル型（string ではない）
```

### なぜ `as const` だけでは不十分か

`as const` だけではリテラル型は保持されるが、オブジェクトが期待する型と一致しているか検証されない。`satisfies Type` を追加することで、コンパイル時に型互換性が保証され、かつリテラル型も維持される。

```typescript
// ❌ 型チェックなし — タイポが検出されない
const bad = {
  kind: "Waitng", // タイポが見逃される
  passengerId: "passenger-1" as PassengerId,
} as const;

// ✅ 型チェックあり + リテラル型保持
const good = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;
```
