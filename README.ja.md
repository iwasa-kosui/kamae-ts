> English version: [README.md](README.md)

# kamae-ts

> _Kamae（構え）— 堅牢なTSサーバを書くために装着する姿勢・備え。_

堅牢なサーバーサイドTypeScriptアプリケーションを設計・実装するための、拡張可能なスキルプラグイン集。各スキルは特定の設計関心に対する**構え**を体系化したもので、コーディングエージェントがコード生成・レビュー時に適用する。

現在の構えは関数型ドメインモデリングを中心に構成されており、今後段階的に拡張されていく。

## 原則の概要

- **Discriminated Union** でドメインの状態を表現し、classを避ける
- **純粋関数** で状態遷移を定義し、無効な遷移をコンパイルエラーにする
- **Result型** (neverthrow / byethrow / fp-ts / option-t) でエラーを値として扱い、例外のthrowを避ける
- **スキーマバリデーション** (Zod / Valibot / ArkType) で外部境界をバリデーションし、ドメイン内部では型を信頼する
- **Sensitive型** でPIIをランタイムレベルで保護する

## インストール

[`gh skill`](https://cli.github.com/manual/gh_skill)（GitHub CLI のエージェントスキル拡張）経由:

```bash
# 単一スキルをインストール（エージェント/スコープは対話で選択）
gh skill install iwasa-kosui/kamae-ts kamae

# 非対話的に Claude Code のユーザースコープへインストール
gh skill install iwasa-kosui/kamae-ts kamae \
  --agent claude-code --scope user

# 特定リリースを固定
gh skill install iwasa-kosui/kamae-ts kamae@v1.0.0
```

または [`skills` CLI](https://github.com/anthropics/skills) 経由:

```bash
npx skills add iwasa-kosui/kamae-ts
```

## 提供スキル

### `kamae`

サーバーサイド TypeScript コード（ドメインモデル、ユースケース、リポジトリ、状態遷移、エラーハンドリング、境界バリデーション、PII 保護）を書くときにトリガーされる。薄い dispatcher SKILL.md がトピック別サブファイル（`domain-modeling.md`, `state-modeling.md`, `error-handling.md`, `boundary-defense.md`, `declarative-style.md`, `test-data.md`）と該当ライブラリ固有ガイドを必要時のみ Read する。

### `kamae-review`

コードレビュー時にトリガーされる。severity タグ付きのレビュー項目（`checklist/*.md` サブファイルに分割）を順に走査し、`kamae` 内の正典原則を引用しながら指摘を返す。ナレッジベースとして `kamae` に依存するため、両者を併せてインストールすること。

## Rules によるカスタマイズ

両スキルは起動のたびに、優先度順で適用可能な rules を読み込む:

1. `.claude/rules/*.md`（プロジェクト）
2. `~/.claude/rules/*.md`（ユーザーグローバル）
3. プラグイン同梱の `rules/defaults/*.md`

frontmatter で `applies-to: kamae`, `applies-to: kamae-review`, あるいは `applies-to: "*"` を宣言した rule のみが kamae-ts に適用される。サポートする 4 種:

- `library-preference` — 特定の Result / validation ライブラリを固定（自動検出をスキップ）
- `check-toggle` — 名前付きレビュー項目の有効化/無効化（例: PII 未取扱プロジェクトでの `pii-protection` 無効化）
- `convention` — プロジェクト固有規約の宣言（例: 「Branded Types は `src/types/brand.ts` に集約」）
- `override` — トピックサブファイルの特定セクションを上書き

rule のフォーマットと具体例は [`rules/README.md`](./rules/README.md) を参照。

スキル全体を置き換えたい場合は、Claude Code 標準の skill path-shadowing（プロジェクトの `.claude/skills/kamae/SKILL.md` がインストール済みプラグインを上書きする）を使う。

## 評価

各スキルの品質を [`microsoft/waza`](https://github.com/microsoft/waza) で継続的に評価している。

- スイートは [`evals/kamae/`](./evals/kamae/) と [`evals/kamae-review/`](./evals/kamae-review/) に配置
- `pull_request` で `skills/**` / `evals/**` / `rules/**` / `.waza.yaml` のいずれかが変更された場合、[`.github/workflows/eval.yml`](./.github/workflows/eval.yml) が `copilot-sdk` executor で実行される
- 採用の背景・前提条件は [ADR 0001](./docs/adr/0001-introduce-waza-for-skill-evals.md) を参照

## ドキュメント

日本語の読み物版は [https://iwasa-kosui.github.io/kamae-ts/](https://iwasa-kosui.github.io/kamae-ts/) に公開されている（`/ja/` 配下）。

## 参考記事

これらの原則は以下の記事群に基づいている:

- [複雑な状態遷移: クラスではなく関数とDiscriminated Unionで状態の定義と遷移を表現する](https://kosui.me/posts/2025/02/20/005900)
- [Discriminated Unionを利用したStateパターンの実現](https://kosui.me/posts/2025/02/25/021320)
- [TypeScriptでドメインイベントを容易に記録できるコード設計を考える](https://kosui.me/posts/2025/05/06/142842)
- [なぜTypeScriptでメソッド記法を避けるべきか？](https://kosui.me/posts/2025/06/02/221656)
- [私がTypeScriptで interface よりも type を好む理由](https://kosui.me/posts/2025/10/23/214710)
- [ログのPII漏洩を防止する: TypeScriptの型推論とランタイムの境界](https://kosui.me/posts/2026/03/16/typescript-pii-logging-defense)
- [サーバーサイドTypeScriptの型システムをどう教えるか](https://kakehashi-dev.hatenablog.com/entry/2026/03/31/110000)
- [TypeScriptのテストにはas const satisfiesが便利です](https://kakehashi-dev.hatenablog.com/entry/2025/12/14/110000)
- [TypeScriptの宣言的な配列操作](https://kakehashi-dev.hatenablog.com/entry/2025/11/19/110000)
- [他言語経験者が知っておきたいTypeScriptのクラスの注意点](https://kakehashi-dev.hatenablog.com/entry/2025/08/19/110000)

## ライセンス

MIT
