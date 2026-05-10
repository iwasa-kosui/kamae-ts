# 宣言的なスタイル 詳細ガイド

## 配列操作

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

## ドメインイベント

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

ドメインイベントの詳細設計（イベント生成の責務、ユースケースとの統合）は [state-modeling.md](./state-modeling.md) を参照。
