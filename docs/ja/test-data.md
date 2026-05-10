---
title: テストデータ
parent: 日本語
nav_order: 6
---

# テストデータガイド

## `as const satisfies` で型安全なテストフィクスチャを定義する

テストのダミーデータは `as const satisfies Type` で型安全に定義します。discriminant のリテラル型が保持され、widening を防ぎます。

```typescript
const waitingRequest = {
  kind: "Waiting",
  passengerId: "passenger-1" as PassengerId,
} as const satisfies Waiting;

// waitingRequest.kind は "Waiting" リテラル型（string ではない）
```

### なぜ `as const` だけでは不十分か

`as const` だけではリテラル型は保持されますが、オブジェクトが期待する型と一致しているかは検証されません。`satisfies Type` を追加することで、コンパイル時に型互換性が保証され、かつリテラル型も維持されます。

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
