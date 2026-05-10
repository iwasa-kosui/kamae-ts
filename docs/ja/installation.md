---
title: インストール
parent: 日本語
nav_order: 0
---

# インストール

`kamae-ts` はコーディングエージェント向けのスキルプラグインとして配布している。以下のいずれかの CLI でインストールできる。

## `gh skill` を使う

[`gh skill`](https://cli.github.com/manual/gh_skill) は GitHub CLI のエージェントスキル拡張である。

```bash
# 単一スキルをインストール（エージェント／スコープを対話的に選択）
gh skill install iwasa-kosui/kamae-ts kamae

# Claude Code 向けに user スコープで非対話的にインストール
gh skill install iwasa-kosui/kamae-ts kamae \
  --agent claude-code --scope user

# 特定のリリースに固定
gh skill install iwasa-kosui/kamae-ts kamae@v1.0.0
```

## `skills` CLI を使う

[`skills`](https://github.com/anthropics/skills) は Anthropic 公式の汎用スキルインストーラー。

```bash
npx skills add iwasa-kosui/kamae-ts
```

このコマンドはプラグインが提供する全スキルを一度にインストールする。

## 提供スキル

| スキル | トリガー条件 |
|--------|--------------|
| [`kamae`](https://github.com/iwasa-kosui/kamae-ts/tree/main/skills/kamae) | サーバーサイド TypeScript のコード生成時。ドメインモデル、ユースケース、リポジトリ、状態遷移、エラーハンドリング、境界バリデーション、PII 保護を扱う。 |
| [`kamae-review`](https://github.com/iwasa-kosui/kamae-ts/tree/main/skills/kamae-review) | コードレビュー時。深刻度タグ付きのチェックリストを順に走査し、`kamae` の正典原則を引用して指摘する。**`kamae` のインストールに依存する** ため、両方を一緒に入れること。 |

## インストールの確認

インストール後、コーディングエージェントの利用可能スキル一覧に `kamae`（および `kamae-review`）が現れる。確認方法はエージェント側のドキュメントを参照すること。たとえば Claude Code では `/skills` を実行して `kamae-ts:kamae` が一覧に含まれていれば成功している。

## カスタマイズ

両スキルは起動時に以下の場所からルールを優先順位順に読み込む。

1. `.claude/rules/*.md`（プロジェクト）
2. `~/.claude/rules/*.md`（ユーザーグローバル）
3. プラグイン同梱の `rules/defaults/*.md`

ルールの frontmatter に `applies-to: kamae`、`applies-to: kamae-review`、または `applies-to: "*"` を宣言すると kamae-ts に適用される。ルール記法と具体例はリポジトリの [`rules/README.md`](https://github.com/iwasa-kosui/kamae-ts/tree/main/rules) を参照。

スキル全体を差し替えたい場合は Claude Code 標準のスキルパスシャドウイングを使う。`.claude/skills/kamae/SKILL.md` を置けばインストール済みプラグインの定義を上書きできる。
