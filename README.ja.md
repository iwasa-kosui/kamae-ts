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
gh skill install iwasa-kosui/kamae-ts functional-ts

# 非対話的に Claude Code のユーザースコープへインストール
gh skill install iwasa-kosui/kamae-ts functional-ts \
  --agent claude-code --scope user

# 特定リリースを固定
gh skill install iwasa-kosui/kamae-ts functional-ts@v0.1.0
```

または [`skills` CLI](https://github.com/anthropics/skills) 経由:

```bash
npx skills add iwasa-kosui/kamae-ts
```

## 提供スキル

### `functional-ts`

TypeScriptのサーバーサイドコード（ドメインモデル、ユースケース、リポジトリ）を書くときに自動トリガーされる。原則に沿ったコード生成をガイドする。

### `functional-ts-review`

コードレビュー時にトリガーされる。原則に反するコードパターン（class使用、型アサーション、例外throw、PII未保護など）を検出し、修正案を提示する。

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
