---
title: エラーハンドリング
parent: 日本語
nav_order: 3
has_children: true
---

# エラーハンドリング詳細ガイド

## 表現方法を選ぶ前に失敗を分類する

想定されるワークフローの結果には `Result` を使います。判断基準は、**この失敗に対して、利用側が行うべきドメイン上の判断が定義されているか**です。定義されていれば、そのユースケースのエラー union に名前付きで表現します。定義されていなければ、アプリケーションのエラー境界まで伝播させます。

ライブラリ固有の API は [result-libraries/](./result-libraries/) 内の該当ガイドを参照してください。

| 分類 | 判断する質問 | 表現 | 責務の所有者 |
| --- | --- | --- | --- |
| 想定されるドメイン失敗 | 呼び出し側が扱い方を選ぶべき業務上の結果か | ユースケース固有の Discriminated Union エラーを `Result` で表現 | ユースケースと呼び出し側 |
| 回復可能な外部障害 | その外部障害後の継続方法がワークフローに定義されているか | そのユースケースの `Result` に名前付きエラーを追加 | ユースケースと呼び出し側 |
| 予期しないインフラ障害 | 依存先の障害が定義済みの回復判断の対象外か | reject された Promise または伝播する例外 | アプリケーションのエラー境界 |
| 契約・不変条件違反 | 型や契約上あり得ない状態に到達したか | 伝播する例外 | アプリケーションのエラー境界と不具合を修正する開発者 |

## ユースケース固有の Result エラー

想定されるエラーは Discriminated Union で定義し、呼び出し側が網羅的に扱えるようにします。汎用的な `AppError` や `RepositoryError` に広げず、各 union をユースケース固有に保ちます。

```typescript
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;

type RequestStore = Readonly<{
  save: (request: EnRoute) => Promise<void>;
}>;
```

DB 接続断などで `RequestStore.save` が予期せず reject された場合は、アプリケーションのエラー境界まで伝播させます。リトライ、フォールバック選択、再試行の依頼などの回復判断がワークフローに定義されている場合に限り、`AssignDriverError` へ名前付き外部エラーを追加します。

## 想定される結果を合成する

想定されるドメイン失敗を生み得る各処理は `Result` を返し、その結果が生じた時点で合成を止めます。合成 API はライブラリごとに異なります（neverthrow/byethrow では `.andThen()`、fp-ts では `pipe` + `chain`、option-t では `flatMapForResult`）。

```typescript
const ensureFound = <T>(id: RequestId) => (
  value: T | undefined,
): Result<T, { readonly kind: "RequestNotFound"; readonly requestId: RequestId }> =>
  value !== undefined
    ? success(value)
    : failure({ kind: "RequestNotFound", requestId: id });
```

Controller 境界で `kind` を分岐し、`AssignDriverError` を HTTP レスポンスへ変換します。ステータスコードの選択は Controller、想定エラーの集合はユースケースが所有します。それとは別に、予期しない障害のログ記録と汎用的な運用レスポンスは、アプリケーションのエラー境界が担います。

## 契約違反とローカル制御フロー

`assertNever` や失敗した内部 assertion は、契約・不変条件違反を表します。その例外はアプリケーションのエラー境界まで伝播させ、汎用的な `Result` エラーへ変換しません。

非公開の制御フロー sentinel は、次の封じ込め条件をすべて満たす場合に限り許容します。

- 狭いローカル操作の非公開実装である
- catch 境界が `unknown` を判別し、自身が所有する sentinel だけを識別する
- catch 境界がそれ以外の値をすべて再 throw する
- バリデーション、無効な状態遷移、その他の想定されるドメイン結果を表さない

```typescript
const foundDriver = Symbol("foundDriver");

type FoundDriver = {
  readonly kind: typeof foundDriver;
  readonly driver: Driver;
};

const isFoundDriver = (error: unknown): error is FoundDriver =>
  typeof error === "object"
  && error !== null
  && "kind" in error
  && error.kind === foundDriver;

const findFirstAvailable = (drivers: readonly Driver[]): Option<Driver> => {
  try {
    drivers.forEach((driver) => {
      if (driver.isAvailable) {
        throw { kind: foundDriver, driver } satisfies FoundDriver;
      }
    });
    return none;
  } catch (error: unknown) {
    if (isFoundDriver(error)) return some(error.driver);
    throw error;
  }
};
```

バリデーションエラー、無効な状態遷移、その他の想定されるドメインエラーの throw は禁止したままです。ユースケース固有の `Result` エラーとしてモデル化してください。
