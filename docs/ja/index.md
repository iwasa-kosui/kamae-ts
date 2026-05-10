---
title: 日本語
description: 堅牢なサーバーサイド TypeScript アプリケーションを設計・実装するための構え（型・規律）の集合
nav_order: 2
has_children: true
permalink: /ja/
---

# kamae-ts — 関数型ドメインモデリング

サーバーサイド TypeScript でドメインモデルを書くときの原則をまとめた読み物。class ベースの OOP ではなく、TypeScript の型システムを最大限に活用した関数型アプローチを採る。

これらは [kamae-ts プラグイン](https://github.com/iwasa-kosui/kamae-ts) が提供するコーディングエージェント向け skill の知識ベースを、人間の読み物として再構成したものである。

## 1. 型によるドメインモデリング

Discriminated Union で状態を表現し、`kind` を discriminant として統一する。`type`（`interface` ではなく）、Companion Object パターン、Branded Types、`Readonly<>`、関数プロパティ記法、1 概念 1 ファイル構成を採る。

→ [domain-modeling.md](./domain-modeling.md)

## 2. 関数による状態遷移

純粋関数で状態遷移を表現する。引数型が有効な遷移元を制約し、戻り値型が遷移先を明示する。無効な遷移はコンパイルエラーとなる。`assertNever` で網羅性をチェックする。

→ [state-modeling.md](./state-modeling.md)

## 3. エラーハンドリング — Railway Oriented Programming

例外を throw せず、Result 型でエラーを値として扱う。エラー型は Discriminated Union で定義し、呼び出し元が網羅的にハンドルできるようにする。

ライブラリ別ガイド: [neverthrow](./result-libraries/neverthrow.md) / [byethrow](./result-libraries/byethrow.md) / [fp-ts](./result-libraries/fp-ts.md) / [option-t](./result-libraries/option-t.md)

→ [error-handling.md](./error-handling.md)

## 4. 境界の防御

外部入力（API リクエスト、DB 結果、ファイル読み込み）はバリデーションライブラリのスキーマで実行時バリデーションする。ドメイン層内部では型を信頼する。型アサーション（`as`）は使わない。PII フィールドには `Sensitive<T>` ラッパーを適用する。

ライブラリ別ガイド: [zod](./validation-libraries/zod.md) / [valibot](./validation-libraries/valibot.md) / [arktype](./validation-libraries/arktype.md)

→ [boundary-defense.md](./boundary-defense.md)

## 5. 宣言的なスタイル

配列の変換は `filter` / `map` / `reduce` で Companion Object の述語関数を使って宣言的に書く。ドメインイベントは不変レコードとしてモデリングする。

→ [declarative-style.md](./declarative-style.md)

## 6. テストデータ

テストデータは `as const satisfies Type` で定義し、discriminant のリテラル型を保持し widening を防ぐ。

→ [test-data.md](./test-data.md)

## コードレビュー

これらの原則に基づいた敵対的コードレビューのガイドは [code-review.md](./code-review.md) を参照。

## 原則の適用について

これらは推奨であり厳格なルールではない。コンテキストに応じて判断してよいが、原則から逸脱する場合はその理由をコメントで明示すること。

典型的な逸脱の正当理由:

- 外部ライブラリが class 継承を要求する場合
- パフォーマンス要件により不変データの生成コストが問題になる場合
- チームの合意により異なるパターンが採用されている場合
