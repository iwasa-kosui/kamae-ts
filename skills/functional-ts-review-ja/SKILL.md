---
name: functional-ts-review-ja
description: サーバーサイドTypeScriptコードを関数型ドメインモデリング原則に照らしてレビューする。class使用、メソッド記法、interface宣言、型アサーション、例外throw、網羅性チェック不足、PII保護をチェックする。
license: MIT
---

# Functional TypeScript Code Review

サーバーサイドTypeScriptコードを関数型ドメインモデリング原則に照らしてレビューする。

## レビュー手順

1. 変更対象のファイルを読む
2. 以下のチェック項目を順にスキャンする
3. 違反を発見した場合、原則と理由を添えて指摘する
4. 違反ではないが改善余地がある場合は提案として伝える

## チェック項目

### 1. ドメインモデルにclassを使っていないか

ドメインエンティティ・値オブジェクトの定義に `class` を使っている場合、Discriminated Union + Companion Objectパターンへの変更を提案する。

外部ライブラリがclass継承を要求している場合は正当な逸脱。

### 2. メソッド記法を使っていないか

型定義内の関数がメソッド記法（`save(task: Task): Promise<void>`）になっている場合、関数プロパティ記法（`save: (task: Task) => Promise<void>`）への変更を指摘する。

メソッド記法はパラメータ型がbivariantになり、依存注入時に狭い型の実装が型チェックを通過してしまう。

### 3. ドメイン型に `interface` を使っていないか

`interface` のdeclaration mergingは、別ファイルで同名のinterfaceを宣言するだけで型の形状が暗黙的に変わる。ドメイン型は `type` で定義する。

ライブラリの型拡張（augmentation）には `interface` が必要。これは正当な用途。

### 4. `as` による型アサーションがないか

`as` は型チェックをバイパスする。以下を確認する:
- 外部データ: バリデーションスキーマ（Zod、Valibot、またはArkType）でパースしているか
- Branded Type生成関数内の `as`: 許容（唯一の例外）
- それ以外: 型推論で解決できないか検討

### 5. ドメイン層で例外をthrowしていないか

ドメイン層（エンティティ、ユースケース）で `throw` を使っている場合、`Result` 型への変更を提案する。

以下は許容:
- `assertNever` 内の throw（到達不能コードの検出）
- インフラ層の予期しない障害

### 6. switch文に assertNever があるか

Discriminated Unionを `switch` で分岐している箇所に `default: return assertNever(x)` がない場合、追加を指摘する。新しいバリアントが追加されたときにコンパイルエラーで検出できなくなる。

### 7. 外部境界にスキーマバリデーションがあるか

APIハンドラ、DB結果の変換、設定ファイルの読み込みなど外部境界で、生のデータを型アサーションなしにドメイン型として扱っていないか確認する。プロジェクトでは外部データのパースにバリデーションライブラリ（Zod、Valibot、またはArkType）を使用すべきである。

### 8. PIIフィールドにSensitiveラッパーがあるか

個人情報（氏名、メールアドレス、電話番号、診断情報など）を含むフィールドが `Sensitive<T>` でラップされているか確認する。特にログに出力される可能性のあるオブジェクトを重点的にチェックする。

## 指摘の書き方

各指摘には以下を含める:

1. **何が問題か**: 具体的なコードの場所
2. **なぜ問題か**: 原則と、違反した場合のリスク
3. **どう直すか**: 修正案のコード例

```
### メソッド記法の使用

`src/repository/task-repository.ts:15`

`save(task: Task): Promise<void>` はメソッド記法です。メソッド記法ではパラメータ型がbivariantになり、
`save(task: DoingTask): Promise<void>` のような狭い型の実装が型チェックを通過します。

修正案:
\`\`\`typescript
type TaskRepository = {
  save: (task: Task) => Promise<void>;
};
\`\`\`
```

## 重要度

チェック項目には以下の重要度がある:

| 重要度 | 項目 | 理由 |
|--------|------|------|
| High | `as` 型アサーション | ランタイムエラーの直接原因 |
| High | PII未保護 | コンプライアンス違反リスク |
| High | 外部境界のスキーマバリデーション不足 | ランタイムエラーの直接原因 |
| Medium | class使用 | 拡張時の型安全性低下 |
| Medium | throw使用 | エラーハンドリングの一貫性 |
| Medium | assertNever不足 | 新バリアント追加時の見落とし |
| Low | メソッド記法 | 特定条件下でのみ問題顕在化 |
| Low | interface使用 | declaration merging事故は稀 |
