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

fp-ts では `TaskEither` による非同期合成を維持します。reject しうる I/O を `Task` として扱わず、`TE.tryCatch` で接続してください。想定外障害は業務エラー union の外にある実行用チャネルで区別して運び、パイプライン実行後の通常の `Promise` 境界で元の cause を再 throw します。これは業務上の回復可能エラーへの変換ではありません。具体例は [fp-ts ガイド](./result-libraries/fp-ts.md) を参照してください。

## fromSafePromise の誤用

`ResultAsync.fromSafePromise`（neverthrow）や他ライブラリの同等の「safe」ラッパーは、渡された Promise が **reject しない** ことを前提にしています。reject しうる Promise（DB クエリ、HTTP 呼び出し、ファイル I/O など）をラップすると、reject 時にエラーが Result チャネルを迂回し、ハンドルされない rejection になります。

```typescript
// Bad: DB呼び出しはrejectしうる — fromSafePromiseではその可能性が無視される
ResultAsync.fromSafePromise(deps.getDriver(driverId))

// Good: 回復方法がワークフローに定義されている場合だけfromPromiseで明示的にエラーをマッピング
ResultAsync.fromPromise(
  deps.getDriver(driverId),
  (cause): GetDriverError => ({ kind: "DriverLookupUnavailable", cause }),
)
```

`fromSafePromise` を使ってよいのは、本当に reject しない Promise だけです — `Promise.resolve(value)` やインメモリのルックアップ、reject しないことがドキュメントに明記されたライブラリ呼び出しなどが該当します。`fromPromise` は名前付きエラーが仕様化された回復判断を表す場合だけ使い、それ以外では操作を await して rejection をアプリケーションのエラー境界まで伝播させます。

## エラー型の設計

エラーも Discriminated Union で定義し、呼び出し元が網羅的にハンドルできるようにします。各バリアントは、コンテキストデータを **型付きフィールド** として公開します。ログや表示用の `message` フィールドを持つこと自体は問題ありませんが、コンテキストの値が `message` にしか存在しない状態は避けます。分岐やリトライに必要な値を文字列からパースしなければならなくなるためです。

```typescript
// Good: コンテキストが型付きフィールドとして利用可能。messageは表示用で省略可
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId; message?: string }>;

type AssignDriver = (
  command: AssignDriverCommand,
) => Promise<Result<AssignedDriver, AssignDriverError>>;

type RequestStore = Readonly<{
  save: (request: EnRoute) => Promise<void>;
}>;

// Bad: driverIdとzoneIdがmessageの中にしかない — 取り出すにはパースが必要
type DriverNotAvailableError = Readonly<{
  kind: "DriverNotAvailableError";
  message: string; // "Driver drv-123 is not available in zone zone-A"
}>;
```

DB 接続断などで `RequestStore.save` が予期せず reject された場合は、アプリケーションのエラー境界まで伝播させます。リトライ、フォールバック選択、再試行の依頼などの回復判断がワークフローに定義されている場合に限り、`AssignDriverError` へ名前付き外部エラーを追加します。

## 想定される結果を合成する

想定されるドメイン失敗を生み得る各処理は `Result` を返し、その結果が生じた時点で合成を止めます。合成 API はライブラリごとに異なります。neverthrow は `.andThen`、byethrow は `Result.andThen`、fp-ts は同期の判断に `E.chain` / `E.bind`、非同期パイプラインに `TE.chain` / `TE.bind`（またはエラー型を広げる `W` 付きの関数）、option-t は `andThenForResult` を使います。

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

非公開の制御フロー sentinel は、同等の `Result` 合成より明確であり、かつ次の封じ込め条件をすべて満たす場合に限り許容します。両者が同程度に明確なら `Result` を優先します。

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
