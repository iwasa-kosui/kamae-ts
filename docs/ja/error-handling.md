---
title: エラーハンドリング
parent: 日本語
nav_order: 3
has_children: true
---

# エラーハンドリング詳細ガイド

## Railway Oriented Programming

Result 型を使い、成功と失敗を型で表現します。例外の throw はドメイン層では使いません。ライブラリ固有の API については [result-libraries/](./result-libraries/) 内の該当ガイドを参照してください。

## エラー型の設計

エラーも Discriminated Union で定義し、呼び出し元が網羅的にハンドルできるようにします。

```typescript
type AssignDriverError =
  | Readonly<{ kind: "RequestNotFound"; requestId: RequestId }>
  | Readonly<{ kind: "InvalidState"; currentKind: string; expectedKind: "Waiting" }>
  | Readonly<{ kind: "DriverNotAvailable"; driverId: DriverId }>;
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
