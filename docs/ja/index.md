---
title: 日本語
description: 堅牢なサーバーサイド TypeScript アプリケーションを設計・実装するための構え（型・規律）の集合
nav_order: 2
has_children: true
permalink: /ja/
---

# kamae-ts — 関数型ドメインモデリング

サーバーサイド TypeScript でドメインモデルを書くときの原則をまとめた読み物です。class ベースの OOP ではなく、TypeScript の型システムを最大限に活用した関数型アプローチを採ります。

[kamae-ts プラグイン](https://github.com/iwasa-kosui/kamae-ts) が提供するコーディングエージェント向け skill の知識ベースを、人間の読み物として再構成したものです。

## 💬 Discord コミュニティに参加する

サーバーサイド TypeScript や関数型ドメインモデリングについての議論・質問・雑談の場として Discord サーバーを運営しています。`kamae-ts` のヘビーユーザーである必要はありません。気軽にどうぞ。

→ **[Discord に参加する](https://discord.gg/Z9HVbqEWzd)**

詳しくは [コミュニティ](./community.md) を参照してください。

## 読み始める

各章は左のサイドバー、または下のリンクから辿れます。

- [型によるドメインモデリング](./domain-modeling.md)
- [関数による状態遷移](./state-modeling.md)
- [エラーハンドリング](./error-handling.md)
- [境界の防御](./boundary-defense.md)
- [宣言的なスタイル](./declarative-style.md)
- [テストデータ](./test-data.md)
- [コードレビュー](./code-review.md)

## 原則の適用について

これらは推奨であり、厳格なルールではありません。コンテキストに応じて判断してかまいませんが、原則から逸脱する場合はその理由をコメントで明示してください。
