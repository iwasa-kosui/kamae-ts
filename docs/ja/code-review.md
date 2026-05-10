---
title: コードレビュー
description: kamae-ts の原則に照らしたサーバーサイド TypeScript コードの敵対的レビューガイド
parent: 日本語
nav_order: 7
---

# 関数型 TypeScript コードレビュー

kamae-ts の原則（[index](./index.md) 参照）に照らしてサーバーサイド TypeScript コードをレビューするためのガイド。各チェック項目は原則の章と 1 対 1 で対応する。

> このガイドは [kamae-ts プラグイン](https://github.com/iwasa-kosui/kamae-ts) の `kamae-review` スキルが内部的に使うチェックリストの読み物版である。コーディングエージェントを使わず手動でレビューを行う場合の参考資料。

## レビュー手順

1. **原則ナレッジを先に読み込む。** コード閲覧の前に以下を読み、指摘で正典の原則を引けるようにする:
   - [index.md](./index.md) — 原則のインデックス
   - [error-handling.md](./error-handling.md)
   - [boundary-defense.md](./boundary-defense.md)
   - [state-modeling.md](./state-modeling.md)
   - プロジェクトの `package.json` に応じたバリデーションライブラリガイド（[validation-libraries/](./validation-libraries/) 配下の `zod.md` / `valibot.md` / `arktype.md`）
   - プロジェクトの `package.json` に応じた Result ライブラリガイド（[result-libraries/](./result-libraries/) 配下の `neverthrow.md` / `byethrow.md` / `fp-ts.md` / `option-t.md`）
2. レビュー対象のファイルを読む。
3. 以下のチェック項目を、原則の順序（[index.md](./index.md) の章立てと一致）でスキャンする。
4. 違反を発見した場合、原則・理由・修正案を添えて指摘する。
5. 違反ではないが改善余地がある場合は提案として伝える。

## チェック項目

チェック項目は [index.md](./index.md) の構造をそのまま反映する。各項目は正典の章へリンクする。

### 1. 型によるドメインモデリング

#### 1.1 ドメイン状態を Discriminated Union でモデリングしているか

参照: [`./index.md` §1「Discriminated Unionで状態を表現する」](./index.md)

兆候: 多数の optional プロパティと `string` の状態フィールドを持つ単一の型（例: `{ state: string; driverId?: string; startTime?: Date }`）。状態ごとに型を分けて union にし、状態固有プロパティを必須にするよう提案する。

#### 1.2 discriminant が `kind` で統一されているか

参照: [`./index.md` §1「discriminantは `kind` で統一する」](./index.md)

兆候: `type`, `status`, `state`, `_tag` など `kind` 以外の discriminant 名。コードベースの一貫性のため `kind` への変更を提案する。

#### 1.3 ドメインモデルに class を使っていないか

参照: [`./index.md` §1「Discriminated Unionで状態を表現する」](./index.md) および Companion Object パターン。

ドメインエンティティ・値オブジェクトの定義に `class` を使っている場合、Discriminated Union + Companion Object パターンへの変更を提案する。外部ライブラリが class 継承を要求する場合は正当な逸脱。

#### 1.4 Companion Object パターンに従っているか

参照: [`./index.md` §1「Companion Object パターン」](./index.md)

以下を確認する:
- 型に関連する操作が、型と同名の `const` に集約されているか。
- Branded Type のバリデーションスキーマが、スタンドアロンの `XxxSchema` ではなく companion object の `.schema` プロパティとして公開されているか。
- companion object に置くべきドメインロジックが、`xxxAssignDriver` のような独立関数として散在していないか。

#### 1.5 ドメイン型に `interface` を使っていないか

参照: [`./index.md` §1「`type` を使う（`interface` ではなく）」](./index.md)

declaration merging により型の形状が暗黙に変わる危険がある。ドメイン型は `type` で定義する。`interface` はライブラリの型拡張（augmentation）の場合のみ許容。

#### 1.6 型定義内でメソッド記法を使っていないか

参照: [`./index.md` §1「関数プロパティ記法を使う（メソッド記法ではなく）」](./index.md)

メソッド記法（`save(task: Task): Promise<void>`）はパラメータが bivariant になり、依存注入時に狭い型の実装（`save(task: DoingTask): …`）が型チェックを通過する。関数プロパティ記法（`save: (task: Task) => Promise<void>`）への変更を提案する。

#### 1.7 意味の異なるプリミティブに Branded Types が適用されているか

参照: [`./index.md` §1「Branded Typesで意味を区別する」](./index.md)。プロジェクトのバリデーションライブラリガイド ([`./validation-libraries/`](./validation-libraries/)) も参照。

兆候: ID や意味の異なる値（`UserId`, `OrderId`, `Email`, 金額など）が素の `string` / `number` で扱われている。バリデーションライブラリがある場合はそのブランド機能で（`as` キャスト不要）、ない場合は `unique symbol` パターンで定義されているかを確認する。

#### 1.8 ドメインオブジェクトが `Readonly<>` か

参照: [`./index.md` §1「`Readonly<>` で不変性を保証する」](./index.md)

兆候: ドメインオブジェクトの型定義が `Readonly<…>`（または各プロパティの `readonly`）で保護されていない。状態変更は新しいオブジェクトの生成で表現する。

#### 1.9 「1 概念 1 ファイル」の構成になっているか

参照: [`./index.md` §1「ファイル構成: 1概念1ファイル」](./index.md)

兆候: `types.ts`, `models.ts`, `domain.ts` のような catch-all ファイルに多数のドメイン型が集約されている、特に companion object が別ファイルにある場合。barrel file（`index.ts`）は re-export のみ。

### 2. 関数による状態遷移

参照: [`./index.md` §2](./index.md) および [`./state-modeling.md`](./state-modeling.md)

#### 2.1 状態遷移関数が引数型で遷移元を制約しているか

兆候: 遷移関数の引数型が個別の状態（`Waiting`）ではなく union（`TaxiRequest`）になっている。広い型を受け取ると、無効な遷移元での呼び出しが許されてしまう。

#### 2.2 Discriminated Union の `switch` に `assertNever` があるか

参照: [`./index.md` §2「網羅性チェック」](./index.md)

兆候: `kind` で分岐する `switch` に `default: return assertNever(x)` がない。新バリアント追加時にコンパイルエラーで検出できなくなる。

### 3. エラーハンドリング — Railway Oriented Programming

参照: [`./index.md` §3](./index.md), [`./error-handling.md`](./error-handling.md), プロジェクトの Result ライブラリガイド ([`./result-libraries/`](./result-libraries/))。

#### 3.1 ドメイン層で例外を throw していないか

兆候: エンティティ・値オブジェクト・ユースケース内の `throw`。`Result` 型への変更を提案する。許容: `assertNever` 内の throw（到達不能）、インフラ層の予期しない障害。

#### 3.2 エラー型が Discriminated Union になっているか

兆候: `Error` のサブクラス、自由形式の `string` エラーコード、`Result<T, string>`。Discriminated Union（`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`）への変更を提案し、呼び出し元が網羅的に分岐できるようにする。

#### 3.3 Result チェーンを使って合成しているか（即 unwrap していないか）

プロジェクトに対応する Result ライブラリの API（`.map`, `.andThen`, `Result.do` など）でチェーン合成しているかを確認する。即 unwrap して if/else に展開している場合は、`./result-libraries/` 配下の該当ガイドを引用して適切なコンビネータを提案する。

### 4. 境界の防御

参照: [`./index.md` §4](./index.md), [`./boundary-defense.md`](./boundary-defense.md), プロジェクトのバリデーションライブラリガイド ([`./validation-libraries/`](./validation-libraries/))。

#### 4.1 すべての外部境界にスキーマバリデーションがあるか

兆候: API ハンドラ、DB 結果のマッピング、キュー・メッセージハンドラ、ファイル・設定の読み込み、環境変数の読み取りなどで、生のデータをバリデーションライブラリ（Zod / Valibot / ArkType）でパースせずにドメイン型として扱っている。

#### 4.2 `as` による型アサーションがないか

参照: [`./index.md` §4「型アサーション（`as`）を使わない」](./index.md)

許容される `as` は `as const` と `as const satisfies Type` のみ。それ以外の `as` をすべて洗い出し、以下のいずれかに該当するか確認する:
- 外部データ・型不明のデータ: スキーマパースで置き換えるべき。`as` は型が主張する保証を与えない。
- Branded Type の生成関数内の `as`: バリデーションライブラリ未導入時の最後の手段としてのみ許容（`unique symbol` パターン）。指摘時には、バリデーションライブラリの導入と `z.brand()` / `v.brand()` / `.brand()` への書き換えで `as` を解消することを推奨する。
- 内部データ: 型推論で解決可能なはず。解決できないなら型設計が誤っている可能性が高い。

#### 4.3 PII フィールドが `Sensitive<T>` でラップされているか

参照: [`./index.md` §4「PIIの防御」](./index.md), [`./boundary-defense.md`](./boundary-defense.md)

兆候: 個人情報を含みうるフィールド（氏名、メールアドレス、電話番号、住所、各種ID、決済情報、健康・診断情報、IP アドレスなど）が素の `string` / `number` のまま。特にログやエラーメッセージに出力されうるオブジェクトを重点的にチェックする。バリデーションスキーマで `Sensitive.of` による自動ラップが行われているかも確認する。

### 5. 宣言的なスタイル

参照: [`./index.md` §5](./index.md), [`./state-modeling.md`](./state-modeling.md)

#### 5.1 配列操作が宣言的か

兆候: `filter` / `map` / `reduce` で表現できる変換を、`for` / `for…of` ループで命令的に組み立てている。述語関数を companion object に定義し、`tasks.filter(Task.isActive)` のように書くよう提案する。

#### 5.2 ドメインイベントが不変レコードとして発行されているか

兆候: 状態変更コードが共有のイベントログを mutate している、あるいは state-modeling ガイドが要求する場面でドメインイベントが発行されていない。`Readonly<{ eventId; eventAt; eventName; payload; aggregateId }>` としてリポジトリと分離して記録する。

#### 5.3 companion object の述語に冗長な `x is Y` 型述語が付いていないか

兆候: discriminated union を受け取る述語関数に、ボディが `kind === "..."`（あるいはその `!==` 否定）だけなのに `: x is Y` の型述語アノテーションを明示している。TypeScript 5.5+ はそのようなボディから型述語を推論し、`Array.prototype.filter` が推論結果を利用するため、アノテーションは何も足していない。むしろ「discriminated union の絞り込みでは型を狭められない」という誤った印象を与える。アノテーションを削除するよう提案する。

### 6. テストデータ

参照: [`./index.md` §6](./index.md)

#### 6.1 フィクスチャが `as const satisfies Type` で定義されているか

兆候: テストフィクスチャが `: Type =` や `as Type` で型付けされており、discriminant のリテラル型が `string` に widening されている。`as const satisfies Type` への変更を提案し、`kind` のリテラル型を保持する。

## 指摘の書き方

各指摘には以下を含める:

1. **何が問題か**: 具体的なコードの場所（`path:line`）。
2. **なぜ問題か**: 原則（`./...` への参照リンク付き）と、違反した場合のリスク。
3. **どう直すか**: 修正案のコード例。

```
### メソッド記法の使用

`src/repository/task-repository.ts:15`

`save(task: Task): Promise<void>` はメソッド記法です。
[`./index.md` §1「関数プロパティ記法を使う」](./index.md)
にあるとおり、メソッド記法ではパラメータが bivariant になり、
`save(task: DoingTask): Promise<void>` のような狭い型の実装が依存注入時に型チェックを通過します。

修正案:
\`\`\`typescript
type TaskRepository = {
  save: (task: Task) => Promise<void>;
};
\`\`\`
```

## 重要度

| 重要度 | 項目 | 理由 |
|--------|------|------|
| High | `as` 型アサーション (4.2) | ランタイムエラーの直接原因 |
| High | PII 未保護 (4.3) | コンプライアンス違反リスク |
| High | 外部境界のスキーマバリデーション不足 (4.1) | ランタイムエラーの直接原因 |
| High | 意味の異なるプリミティブの Branded Types 不足 (1.7) | 異種 ID の取り違えがランタイムで発生 |
| Medium | class 使用 (1.3) | 拡張時の型安全性低下 |
| Medium | optional プロパティでの状態モデリング (1.1) | 不正な状態が表現可能になる |
| Medium | ドメイン層での `throw` (3.1) | エラーハンドリングの一貫性欠如 |
| Medium | 非 Discriminated Union のエラー型 (3.2) | 呼び出し元が網羅的に分岐できない |
| Medium | `assertNever` 不足 (2.2) | 新バリアント追加時の見落とし |
| Medium | union 型を受ける状態遷移関数 (2.1) | 無効な遷移がコンパイルを通る |
| Medium | catch-all 型ファイル (1.9) | 循環依存・型と振る舞いの分離 |
| Medium | Companion Object パターン違反・スキーマ単独 export (1.4) | 実装詳細の漏洩 |
| Low | メソッド記法 (1.6) | 特定条件下でのみ問題顕在化 |
| Low | ドメイン型の `interface` 使用 (1.5) | declaration merging 事故は稀 |
| Low | `Readonly<>` 未使用のドメイン型 (1.8) | mutation はレビューで気付ける場合が多い |
| Low | discriminant が `kind` 以外 (1.2) | バグというよりスタイル不一致 |
| Low | 命令的な配列ループ (5.1) | 正確性ではなく可読性 |
| Low | ドメインイベント不発行 (5.2) | event sourcing の採否次第 |
| Low | 冗長な `x is Y` 型述語 (5.3) | 文字数の無駄。discriminated union の絞り込みについて誤解を招く |
| Low | フィクスチャに `as const satisfies` がない (6.1) | 実務上はテストで検出される |
