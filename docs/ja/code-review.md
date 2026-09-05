---
title: コードレビュー
description: kamae-ts の原則に照らしたサーバーサイド TypeScript コードの敵対的レビューガイド
parent: 日本語
nav_order: 7
---

# 関数型 TypeScript コードレビュー

kamae-ts の原則（[index](./index.md) 参照）に照らしてサーバーサイド TypeScript コードをレビューするためのガイドです。各チェック項目は原則の章と 1 対 1 で対応します。

> このガイドは [kamae-ts プラグイン](https://github.com/iwasa-kosui/kamae-ts) の `kamae-review` スキルが内部的に使うチェックリストの読み物版です。コーディングエージェントを使わず手動でレビューを行う場合の参考資料として活用してください。

## レビュー手順

1. **原則ナレッジを先に読み込みます。** コード閲覧の前に以下を読み、指摘で正典の原則を引けるようにしておきます。
   - [index.md](./index.md) — 原則のインデックス
   - [error-handling.md](./error-handling.md)
   - [boundary-defense.md](./boundary-defense.md)
   - [state-modeling.md](./state-modeling.md)
   - プロジェクトの `package.json` に応じたバリデーションライブラリガイド（[validation-libraries/](./validation-libraries/) 配下の `zod.md` / `valibot.md` / `arktype.md`）
   - プロジェクトの `package.json` に応じた Result ライブラリガイド（[result-libraries/](./result-libraries/) 配下の `neverthrow.md` / `byethrow.md` / `fp-ts.md` / `option-t.md`）
2. レビュー対象のファイルを読みます。
3. 以下のチェック項目を、原則の順序（[index.md](./index.md) の章立てと一致）でスキャンします。
4. 違反を発見した場合、原則・理由・修正案を添えて指摘します。
5. 違反ではないが改善余地がある場合は提案として伝えます。

## チェック項目

チェック項目は [index.md](./index.md) の構造をそのまま反映しています。各項目は正典の章へリンクします。

### 1. 型によるドメインモデリング

#### 1.1 ドメイン状態を Discriminated Union でモデリングしているか

参照: [`./index.md` §1「Discriminated Unionで状態を表現する」](./index.md)

兆候: 多数の optional プロパティと `string` の状態フィールドを持つ単一の型（例: `{ state: string; driverId?: string; startTime?: Date }`）。状態ごとに型を分けて union にし、状態固有プロパティを必須にするよう提案します。

#### 1.2 discriminant が `kind` で統一されているか

参照: [`./index.md` §1「discriminantは `kind` で統一する」](./index.md)

兆候: `type`、`status`、`state`、`_tag` など `kind` 以外の discriminant 名。コードベースの一貫性のため `kind` への変更を提案します。

#### 1.3 ドメインモデルに class を使っていないか

参照: [`./index.md` §1「Discriminated Unionで状態を表現する」](./index.md) および Companion Object パターン。

ドメインエンティティ・値オブジェクトの定義に `class` を使っている場合、Discriminated Union + Companion Object パターンへの変更を提案します。外部ライブラリが class 継承を要求する場合は正当な逸脱です。

#### 1.4 Companion Object パターンに従っているか

参照: [`./index.md` §1「Companion Object パターン」](./index.md)

以下を確認します。
- 型に関連する操作が、型と同名の `const` に集約されているか。
- Branded Type のバリデーションスキーマが、スタンドアロンの `XxxSchema` ではなく companion object の `.schema` プロパティとして公開されているか。
- companion object に置くべきドメインロジックが、`xxxAssignDriver` のような独立関数として散在していないか。

#### 1.5 ドメイン型に `interface` を使っていないか

参照: [`./index.md` §1「`type` を使う（`interface` ではなく）」](./index.md)

declaration merging により型の形状が暗黙に変わる危険があります。ドメイン型は `type` で定義します。`interface` はライブラリの型拡張（augmentation）の場合のみ許容します。

#### 1.6 型定義内でメソッド記法を使っていないか

参照: [`./index.md` §1「関数プロパティ記法を使う（メソッド記法ではなく）」](./index.md)

メソッド記法（`save(task: Task): Promise<void>`）はパラメータが bivariant になり、依存注入時に狭い型の実装（`save(task: DoingTask): …`）が型チェックを通過してしまいます。関数プロパティ記法（`save: (task: Task) => Promise<void>`）への変更を提案します。

#### 1.7 意味の異なるプリミティブに Branded Types が適用されているか

参照: [`./index.md` §1「Branded Typesで意味を区別する」](./index.md)。プロジェクトのバリデーションライブラリガイド ([`./validation-libraries/`](./validation-libraries/)) も参照してください。

兆候: ID や意味の異なる値（`UserId`、`OrderId`、`Email`、金額など）が素の `string` / `number` で扱われている。バリデーションライブラリがある場合はそのブランド機能で（`as` キャスト不要）、ない場合は `unique symbol` パターンで定義されているかを確認します。

#### 1.8 ドメインオブジェクトが `Readonly<>` か

参照: [`./index.md` §1「`Readonly<>` で不変性を保証する」](./index.md)

兆候: ドメインオブジェクトの型定義が `Readonly<…>`（または各プロパティの `readonly`）で保護されていない。状態変更は新しいオブジェクトの生成で表現します。

#### 1.9 「1 概念 1 ファイル」の構成になっているか

参照: [`./index.md` §1「ファイル構成: 1概念1ファイル」](./index.md)

兆候: `types.ts`、`models.ts`、`domain.ts` のような catch-all ファイルに多数のドメイン型が集約されている、特に companion object が別ファイルにある場合。barrel file（`index.ts`）は re-export のみにしてください。

#### 1.10 ドメイン向けのポートを domain 層が所有しているか

参照: [「ポートは domain 層に配置する」](./domain-modeling.md#ポートは-domain-層に配置する)

兆候: リポジトリ、resolver、store などのドメイン向けの依存契約が domain 層の外にある、または `domain/ports/` を含む専用の `port/` や `ports/` ディレクトリに集められている。各契約を対象のドメイン概念のそば（例: `src/domain/task/task-store.ts`）へ移すよう提案します。ユースケースとアダプターは domain 層が所有する契約を import し、具体的な I/O の実装は infrastructure 層に残します。

配置だけの問題は Low とします。domain の契約が infrastructure の実装、DB クライアント、外部 SDK の型を import している場合は、その依存を示して Medium とします。ディレクトリ名だけで依存方向の違反やランタイム障害を推測しません。infrastructure 層に正しく配置されたリポジトリアダプターは、配置を誤ったポートではありません。契約の定義か実装かを確認し、明示的なプロジェクトの上書きルールを尊重します。

#### 1.11 resolver と store を分離し、原則として単一操作にしているか

参照: [「resolver と store を操作ごとに分離する」](./domain-modeling.md#resolver-と-store-を操作ごとに分離する)

兆候: 注入する契約が読み取りと書き込みを混在させている、またはプロジェクト上の理由が記されていないのに resolver／store が複数の独立した操作を公開している。契約とその利用側を示し、Low として報告します。原則として単一メソッドの契約へ分離し、各利用側には必要な契約だけを渡すよう提案します。イベントを書くだけの利用側に resolver は不要です。

名前ではなく責務で判断します。単一操作の resolver にある `findById` や、単一操作の契約に付けられた `Repository` という名前自体は違反ではありません。アダプター間での DB クライアント共有や、composition root での複数の契約の組み立ては許容します。状態とイベントの原子的な保存は一つの store メソッドに保ちます。広い契約を要求する明示的なプロジェクトルールを尊重し、トレードオフを説明します。

### 2. 関数による状態遷移

参照: [`./index.md` §2](./index.md) および [`./state-modeling.md`](./state-modeling.md)

#### 2.1 状態遷移関数が引数型で遷移元を制約しているか

兆候: 遷移関数の引数型が個別の状態（`Waiting`）ではなく union（`TaxiRequest`）になっている。広い型を受け取ると、無効な遷移元での呼び出しが許されてしまいます。

#### 2.2 Discriminated Union の `switch` に `assertNever` があるか

参照: [`./index.md` §2「網羅性チェック」](./index.md)

兆候: `kind` で分岐する `switch` に `default: return assertNever(x)` がない。新バリアント追加時にコンパイルエラーで検出できなくなります。

### 3. エラーハンドリング — Railway Oriented Programming

参照: [`./index.md` §3](./index.md)、[`./error-handling.md`](./error-handling.md)、プロジェクトの Result ライブラリガイド ([`./result-libraries/`](./result-libraries/))。

#### 3.1 各失敗が適切な境界を越えているか

観測した `throw` や catch されたエラーを指摘する前に分類します。判断基準は、この失敗に対して利用側が行うべきドメイン上の判断が定義されているかです。

| 観測した失敗 | レビューでの対応 |
| --- | --- |
| 想定されるバリデーション・業務状態の失敗を throw している | ユースケース固有の `Result` エラーを求める |
| 回復方法が定義された外部障害を throw している | 名前付きの回復可能な失敗を `Result` でモデル化する |
| 任意の技術的障害を catch し、汎用エラーへラップまたは改名してドメインの `Result` union に追加している | 型名やフィールド名に関係なく、汎用的なドメインエラーにせずアプリケーションのエラー境界まで伝播させる |
| 非公開 sentinel が、`unknown` の判別後に対応する境界で catch され、それ以外の値がすべて再 throw される | 指摘なし |

`assertNever` 内の `throw`、伝播する内部 assertion の失敗、アプリケーションのエラー境界へ到達する予期しない障害は指摘しません。その境界がログ記録と汎用的な運用レスポンスを所有します。非公開 sentinel は、同等の `Result` 合成より明確で、狭い範囲に限定され、対応する catch 境界だけが識別し、それ以外をすべて再 throw し、想定されるドメイン失敗を表さない場合に限り許容します。両者が同程度に明確なら `Result` を優先します。assertion や任意の技術的障害を汎用的なドメインの `Result` エラーに変換する実装は、ラッパーが `RepositoryError` 以外の名前で、ペイロードが `cause` 以外の名前でも指摘対象です。

`ResultAsync.fromSafePromise`（または他ライブラリの同等の「safe」ラッパー）で reject しうる Promise（DB 呼び出し、ネットワーク I/O、外部 API 呼び出し）をラップしている場合も指摘します。`fromSafePromise` は「この Promise は reject しない」という契約であり、違反すると Result のエラーチャネルを迂回してハンドルされない rejection が発生します。ワークフローに回復判断が定義されている場合だけ、名前付きエラーを伴う `fromPromise` への変更を提案します。それ以外では rejection をアプリケーションのエラー境界まで伝播させます。参照: [`./error-handling.md` §fromSafePromise の誤用](./error-handling.md)

fp-ts では、内部の `TaskEither` が想定外障害を業務エラーとは別の実行用チャネルで運び、実行後の通常の `Promise` 境界が元の cause を再 throw する構成は指摘しません。業務エラー union へ追加することや、業務結果として公開することとは区別してください。reject しうる I/O を `Task` / `TE.fromTask` で扱う実装や、`TE.tryCatch` のエラーマッパー内で再 throw する実装は契約違反として指摘します。[fp-ts ガイド](./result-libraries/fp-ts.md) を参照してください。

#### 3.2 エラー型が Discriminated Union になっているか

`Result` や公開された業務契約に含む想定エラーについて、`Error` のサブクラス、自由形式の `string` エラーコード、`Result<T, string>` を指摘します。Discriminated Union（`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`）への変更を提案し、呼び出し側が想定される結果を網羅的に分岐できるようにします。アプリケーションのエラー境界まで伝播する予期しないインフラ障害、assertion、契約違反の例外には、このルールを適用しません。

エラー DU のバリアントで、コンテキストデータ（ID、コード、エラーの原因となった値）が `message: string` にしか存在せず、型付きフィールドとして公開されていない場合も指摘します。`message` フィールド自体はログや表示用に持っていて構いませんが、分岐やリトライに必要な値を message のパースで取得しなければならない状態は、型付きエラーの利点を失わせます。関連するコンテキストを `message` と並行して名前付きフィールドとして追加するよう提案します。参照: [`./error-handling.md` §エラー型の設計](./error-handling.md)

#### 3.3 Result 合成で不要な unwrap/re-wrap をしていないか

想定される判断の合成途中で、unwrap した直後に re-wrap する不要な実装だけを指摘します。その場合は `./result-libraries/` 配下の該当ガイドを引用し、対応するコンビネータを提案します。想定される判断が完了した後の明確な `if` や `match` は許容します。特に、reject を伝播させるべき通常の非同期永続化境界では適切です。option-t の公式レシピも、その境界で意図的に明示的な分岐を使っています。

`andThen` / `map` のコールバックが約 5 行を超えていたり、複数分岐の if/else ロジックを含んでいたりする場合も指摘します。これは Result コンビネータで包んだ手続き的コードであり、Railway Oriented Programming ではありません。各論理ステップを名前付き関数に抽出し、チェーンがフラットなパイプラインとして読めるようにすることを提案します。参照: [`./error-handling.md` §処理の合成](./error-handling.md)

### 4. 境界の防御

参照: [`./index.md` §4](./index.md)、[`./boundary-defense.md`](./boundary-defense.md)、プロジェクトのバリデーションライブラリガイド ([`./validation-libraries/`](./validation-libraries/))。

#### 4.1 すべての外部境界にスキーマバリデーションがあるか

兆候: API ハンドラ、DB 結果のマッピング、キュー・メッセージハンドラ、ファイル・設定の読み込み、環境変数の読み取りなどで、生のデータをバリデーションライブラリ（Zod / Valibot / ArkType）でパースせずにドメイン型として扱っている。

#### 4.2 `as` による型アサーションがないか

参照: [`./index.md` §4「型アサーション（`as`）を使わない」](./index.md)

許容される `as` は `as const` と `as const satisfies Type` のみです。それ以外の `as` をすべて洗い出し、以下のいずれかに該当するかを確認します。
- 外部データ・型不明のデータ: スキーマパースで置き換えるべきです。`as` は型が主張する保証を与えません。
- Branded Type の生成関数内の `as`: バリデーションライブラリ未導入時の最後の手段としてのみ許容します（`unique symbol` パターン）。指摘時には、バリデーションライブラリの導入と `z.brand()` / `v.brand()` / `.brand()` への書き換えで `as` を解消することを推奨します。
- 内部データ: 型推論で解決可能なはずです。解決できないなら型設計が誤っている可能性が高いです。

#### 4.3 PII フィールドが `Sensitive<T>` でラップされているか

参照: [`./index.md` §4「PIIの防御」](./index.md)、[`./boundary-defense.md`](./boundary-defense.md)

兆候: 個人情報を含みうるフィールド（氏名、メールアドレス、電話番号、住所、各種 ID、決済情報、健康・診断情報、IP アドレスなど）が素の `string` / `number` のまま。特にログやエラーメッセージに出力されうるオブジェクトを重点的にチェックします。バリデーションスキーマで `Sensitive.of` による自動ラップが行われているかも確認します。

### 5. 宣言的なスタイル

参照: [`./index.md` §5](./index.md)、[`./state-modeling.md`](./state-modeling.md)

#### 5.1 配列操作が宣言的か

兆候: `filter` / `map` / `reduce` で表現できる変換を、`for` / `for…of` ループで命令的に組み立てている。述語関数を companion object に定義し、`tasks.filter(Task.isActive)` のように書くよう提案します。

#### 5.2 ドメインイベントが不変レコードとして発行されているか

兆候: 状態変更コードが共有のイベントログを mutate している、あるいは state-modeling ガイドが要求する場面でドメインイベントが発行されていない。`Readonly<{ eventId; eventAt; eventName; payload; aggregateId }>` としてリポジトリと分離して記録します。

#### 5.3 companion object の述語に冗長な `x is Y` 型述語が付いていないか

兆候: discriminated union を受け取る述語関数に、ボディが `kind === "..."`（あるいはその `!==` 否定）だけなのに `: x is Y` の型述語アノテーションを明示している。TypeScript 5.5+ はそのようなボディから型述語を推論し、`Array.prototype.filter` が推論結果を利用するため、アノテーションは何も足していません。むしろ「discriminated union の絞り込みでは型を狭められない」という誤った印象を与えてしまいます。アノテーションを削除するよう提案します。

### 6. テストデータ

参照: [`./index.md` §6](./index.md)

#### 6.1 フィクスチャが `as const satisfies Type` で定義されているか

兆候: テストフィクスチャが `: Type =` や `as Type` で型付けされており、discriminant のリテラル型が `string` に widening されている。`as const satisfies Type` への変更を提案し、`kind` のリテラル型を保持します。

## 指摘の書き方

各指摘には以下を含めます。

1. **何が問題か**: 具体的なコードの場所（`path:line`）。
2. **なぜ問題か**: 原則（`./...` への参照リンク付き）と、違反した場合のリスク。
3. **どう直すか**: 修正案のコード例。

```
### メソッド記法の使用

`src/domain/task/task-store.ts:15`

`save(task: Task): Promise<void>` はメソッド記法です。
[`./index.md` §1「関数プロパティ記法を使う」](./index.md)
にあるとおり、メソッド記法ではパラメータが bivariant になり、
`save(task: DoingTask): Promise<void>` のような狭い型の実装が依存注入時に型チェックを通過します。

修正案:
\`\`\`typescript
type TaskStore = {
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
| Medium | 想定されるドメイン・業務・バリデーション失敗の `throw` (3.1) | 呼び出し側が想定される結果を明示的に扱えない |
| Medium | `Result` または公開業務契約の想定エラーが非 Discriminated Union (3.2) | 呼び出し側が想定エラーを網羅的に分岐できない |
| Medium | `assertNever` 不足 (2.2) | 新バリアント追加時の見落とし |
| Medium | union 型を受ける状態遷移関数 (2.1) | 無効な遷移がコンパイルを通る |
| Medium | catch-all 型ファイル (1.9) | 循環依存・型と振る舞いの分離 |
| Medium | Companion Object パターン違反・スキーマ単独 export (1.4) | 実装詳細の漏洩 |
| Medium | domain の契約が infrastructure の型に依存 (1.10) | ドメインが具体的な実装と結合する |
| Low | 外向きの依存を伴わないポートの配置違反 (1.10) | 契約が所有元のドメイン概念から離れる |
| Low | 必要以上に広い resolver／store の契約 (1.11) | 利用側が無関係な操作に依存する |
| Low | メソッド記法 (1.6) | 特定条件下でのみ問題顕在化 |
| Low | ドメイン型の `interface` 使用 (1.5) | declaration merging 事故は稀 |
| Low | `Readonly<>` 未使用のドメイン型 (1.8) | mutation はレビューで気付ける場合が多い |
| Low | discriminant が `kind` 以外 (1.2) | バグというよりスタイル不一致 |
| Low | 命令的な配列ループ (5.1) | 正確性ではなく可読性 |
| Low | ドメインイベント不発行 (5.2) | event sourcing の採否次第 |
| Low | 冗長な `x is Y` 型述語 (5.3) | 文字数の無駄。discriminated union の絞り込みについて誤解を招く |
| Low | フィクスチャに `as const satisfies` がない (6.1) | 実務上はテストで検出される |
