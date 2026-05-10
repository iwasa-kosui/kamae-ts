---
title: 宣言的なスタイル
parent: 日本語
nav_order: 5
---

# 宣言的なスタイル 詳細ガイド

## 配列操作

配列の変換は `filter` / `map` / `reduce` で宣言的に書きます。述語関数は Companion Object に定義します。

```typescript
type Task = ActiveTask | CompletedTask;

const Task = {
  isActive: (task: Task) => task.kind === "Active",
} as const;

// 宣言的: 「何をしたいか」が明確
const activeTasks = tasks.filter(Task.isActive);

// 命令的: ループの中身を読まないと意図がわからない
const activeTasks: ActiveTask[] = [];
for (const task of tasks) {
  if (task.kind === "Active") activeTasks.push(task);
}
```

### 冗長な `x is Y` 型述語を書かない

discriminated union を受け取る述語関数に、`: x is Y` の型述語アノテーションを明示する必要はありません。TypeScript 5.5+ は `kind` で絞り込むボディから型述語を自動的に推論し、`Array.prototype.filter` はその推論結果を利用します。アノテーションを書くと「discriminated union の絞り込みだけでは型を狭められない」という誤った印象を読み手に与えます。

```typescript
// ❌ 冗長: 推論で十分
isActive: (task: Task): task is ActiveTask => task.kind === "Active",

// ✅ コンパイラの推論に任せる
isActive: (task: Task) => task.kind === "Active",
```

複数状態への絞り込みも同様です。`kind === "..." || kind === "..."` や `kind !== "..." && kind !== "..."` のいずれの形でも、TS 5.5+ は正しい型述語に推論します。

## ドメインイベント

状態変更に伴うドメインイベントは不変レコードとして生成し、リポジトリとは分離して記録します。

```typescript
type DomainEvent = Readonly<{
  eventId: string;
  eventAt: Date;
  eventName: string;
  payload: unknown;
  aggregateId: string;
}>;
```

ドメインイベントの詳細設計（イベント生成の責務、ユースケースとの統合）は [state-modeling.md](./state-modeling.md) を参照してください。
