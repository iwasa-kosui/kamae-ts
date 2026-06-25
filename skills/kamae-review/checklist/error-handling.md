# Error Handling Checklist

Reference: [`../../kamae/SKILL.md` §3](../../kamae/SKILL.md), [`../../kamae/error-handling.md`](../../kamae/error-handling.md), and the project's Result library guide under [`../../kamae/result-libraries/`](../../kamae/result-libraries/).

## 3.1 Are exceptions thrown in the domain layer? — Medium

Flag: `throw` in entities, value objects, or use cases. Suggest migrating to `Result`. Acceptable: `throw` inside `assertNever` (unreachable) and unexpected failures in the infrastructure layer.

Also flag: `ResultAsync.fromSafePromise` (or equivalent "safe" wrapper in other libraries) wrapping a Promise that can reject — database calls, network I/O, external API calls. `fromSafePromise` is a contract stating the Promise never rejects; violating it bypasses the Result error channel and produces an unhandled rejection at runtime. Suggest `fromPromise` with an explicit error mapper, and include the mapped error type in the function's error union. See [`../../kamae/error-handling.md` §fromSafePromise](../../kamae/error-handling.md).

## 3.2 Are error types Discriminated Unions? — Medium

Flag: `Error` subclasses, free-form `string` error codes, or `Result<T, string>`. Suggest a Discriminated Union (`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`) so callers can branch exhaustively.

Also flag: error DU variants where contextual data (IDs, codes, values that caused the error) exists only in a `message: string` field and is not exposed as typed fields. A `message` field itself is fine for logging or display, but when callers must parse it to extract values for branching or retry logic, the typed error has lost its purpose. Suggest adding the relevant context as named fields alongside `message`. See [`../../kamae/error-handling.md` §Error Type Design](../../kamae/error-handling.md).

## 3.3 Are Result chains used instead of nested if/else? — Low

Verify that the project uses the matching Result library API (`.map`, `.andThen`, `Result.do`, …) rather than unwrapping immediately into branching code. Cite the matching guide under `../../kamae/result-libraries/` for the correct combinator.

Also flag: `andThen` / `map` callbacks exceeding ~5 lines or containing multi-branch if/else logic. This is procedural code wrapped in a Result combinator, not Railway Oriented Programming. Suggest extracting each logical step into a named function so the chain reads as a flat pipeline of operations. See [`../../kamae/error-handling.md` §Composing Operations](../../kamae/error-handling.md).
