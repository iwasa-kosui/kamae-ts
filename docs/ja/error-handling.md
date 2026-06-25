---
title: エラーハンドリング
parent: 日本語
nav_order: 3
has_children: true
---

# エラーハンドリング詳細ガイド

## Railway Oriented Programming

Result 型を使い、成功と失敗を型で表現します。例外の throw はドメイン層では使いません。ライブラリ固有の API については [result-libraries/](./result-libraries/) 内の該当ガイドを参照してください。

## fromSafePromise の誤用

`ResultAsync.fromSafePromise`（neverthrow）や他ライブラリの同等の「safe」ラッパーは、渡された Promise が **reject しない** ことを前提にしています。reject しうる Promise（DB クエリ、HTTP 呼び出し、ファイル I/O など）をラップすると、reject 時にエラーが Result チャネルを迂回し、ハンドルされない rejection になります。

```typescript
// Bad: DB呼び出しはrejectしうる — fromSafePromiseではその可能性が無視される
ResultAsync.fromSafePromise(deps.getDriver(driverId))

// Good: fromPromiseで明示的にエラーをマッピング
ResultAsync.fromPromise(
  deps.getDriver(driverId),
  (cause): RepositoryError => ({ kind: "RepositoryError", cause }),
)
```

`fromSafePromise` を使ってよいのは、本当に reject しない Promise だけです — `Promise.resolve(value)` やインメモリのルックアップ、reject しないことがドキュメントに明記されたライブラリ呼び出しなどが該当します。

## エラー型の設計

エラーも Discriminated Union で定義し、呼び出し元が網羅的にハンドルできるようにします。各バリアントは、コンテキストデータを **型付きフィールド** として公開します。ログや表示用の `message` フィールドを持つこと自体は問題ありませんが、コンテキストの値が `message` にしか存在しない状態は避けます。分岐やリトライに必要な値を文字列からパースしなければならなくなるためです。

```typescript
// Good: コンテキストが型付きフィールドとして利用可能。messageは表示用で省略可
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId; message?: string }>;

// Bad: driverIdとzoneIdがmessageの中にしかない — 取り出すにはパースが必要
type DriverNotAvailableError = Readonly<{
  kind: "DriverNotAvailableError";
  message: string; // "Driver drv-123 is not available in zone zone-A"
}>;
```

### エラー型の粒度

各ユースケースが返すエラー型は、そのユースケース固有のものにします。共通のエラー型（`AppError`）にすべてを詰め込むと、呼び出し元が「実際にはどのエラーが起こりうるか」を型から判断できなくなります。

```typescript
// Good: ユースケース固有のエラー型
type AssignDriverError = RequestNotFoundError | InvalidStateError | DriverNotAvailableError;
type StartTripError = RequestNotFoundError | InvalidStateError;

// Bad: 全エラーを1つに詰め込む
type AppError = RequestNotFoundError | InvalidStateError | DriverNotAvailableError | ...;
```

## 処理の合成

各ステップが Result 型を返し、エラーが発生した時点で後続のステップはスキップされます。合成の API はライブラリごとに異なります（neverthrow/byethrow では `.andThen()`、fp-ts では `pipe` + `chain`、option-t では `flatMapForResult`）。

### ヘルパー関数

共通のバリデーションは小さな関数に切り出し、合成の各ステップとして使います。

```typescript
// ヘルパーの戻り値はResult型。具体的なAPI（ok/err, right/left等）はライブラリに依存
const ensureFound = <T>(id: RequestId) => (
  value: T | undefined,
): Result<T, RequestNotFoundError> =>
  value !== undefined
    ? success(value)   // ok(), right(), createOk() 等
    : failure({ kind: "RequestNotFound", requestId: id });

const ensureWaiting = (
  request: TaxiRequest,
): Result<Waiting, InvalidStateError> =>
  request.kind === "Waiting"
    ? success(request)
    : failure({ kind: "InvalidState", currentKind: request.kind, expectedKind: "Waiting" });
```

## Controller層でのエラー変換

ドメインエラーを HTTP レスポンスに変換するのは Controller 層の責務です。ドメインエラーの kind に基づいてステータスコードを決定します。

```typescript
const toHttpResponse = (error: AssignDriverError): Response => {
  switch (error.kind) {
    case "RequestNotFound":
      return notFound(`Request ${error.requestId} not found`);
    case "InvalidState":
      return conflict(`Expected ${error.expectedKind}, got ${error.currentKind}`);
    case "DriverNotAvailable":
      return unprocessableEntity(`Driver ${error.driverId} is not available`);
    default:
      return assertNever(error);
  }
};
```

## 例外を使うべき場所

ドメイン層では例外をスローしませんが、以下の場所では例外が適切です。

- `assertNever`: 到達不能コードの検出（プログラムのバグ）
- インフラ層の予期しない障害（DB 接続断など）— これはフレームワークのエラーハンドラに任せます
