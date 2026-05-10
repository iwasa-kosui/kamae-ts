# Error Handling Checklist

Reference: [`../../kamae/SKILL.md` §3](../../kamae/SKILL.md), [`../../kamae/error-handling.md`](../../kamae/error-handling.md), and the project's Result library guide under [`../../kamae/result-libraries/`](../../kamae/result-libraries/).

## 3.1 Are exceptions thrown in the domain layer? — Medium

Flag: `throw` in entities, value objects, or use cases. Suggest migrating to `Result`. Acceptable: `throw` inside `assertNever` (unreachable) and unexpected failures in the infrastructure layer.

## 3.2 Are error types Discriminated Unions? — Medium

Flag: `Error` subclasses, free-form `string` error codes, or `Result<T, string>`. Suggest a Discriminated Union (`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`) so callers can branch exhaustively.

## 3.3 Are Result chains used instead of nested if/else? — Low

Verify that the project uses the matching Result library API (`.map`, `.andThen`, `Result.do`, …) rather than unwrapping immediately into branching code. Cite the matching guide under `../../kamae/result-libraries/` for the correct combinator.
