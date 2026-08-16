# Error Handling Checklist

Reference: [`../../kamae/SKILL.md` §3](../../kamae/SKILL.md), [`../../kamae/error-handling.md`](../../kamae/error-handling.md), and the project's Result library guide under [`../../kamae/result-libraries/`](../../kamae/result-libraries/).

## 3.1 Does each failure cross the boundary appropriately? — Medium

Classify an observed `throw` or caught error before reporting it:

1. Is it an expected validation or business-state failure? It must be returned as a use-case-specific `Result` error.
2. Is it an external failure with documented recovery? Model that named, recoverable failure in `Result` rather than throwing it.
3. Does the code catch an arbitrary technical fault, wrap or rename it as a catch-all error, and add that error to a domain `Result` union? Flag the structure regardless of the type or field names: unknown infrastructure faults should propagate to the application error boundary instead of becoming catch-all domain errors.
4. Is the exception only a private local-control-flow sentinel, clearer than equivalent `Result` composition, caught by its associated boundary after discriminating `unknown`, and rethrowing every other value? Do not report it. Prefer `Result` when the two forms are equally clear.

| Observed failure | Review action |
| --- | --- |
| Expected validation or business-state failure is thrown | Medium: require a use-case-specific Result error |
| External failure has a documented recovery but is thrown | Medium: model the named recoverable failure in Result |
| Unknown outage, config defect, or assertion is wrapped in a catch-all technical error, whatever it is named | Medium: allow propagation instead of a catch-all domain error |
| Private sentinel is caught by its associated boundary and rethrows unknown errors | No finding |

Do not report `throw` inside `assertNever`, a failed internal assertion that is allowed to propagate, or an unexpected fault that is allowed to reach the application error boundary. Converting an assertion into a catch-all `Result` error remains a Medium finding.

Also flag: `ResultAsync.fromSafePromise` (or equivalent "safe" wrapper in other libraries) wrapping a Promise that can reject — database calls, network I/O, external API calls. `fromSafePromise` is a contract stating the Promise never rejects; violating it bypasses the Result error channel and produces an unhandled rejection at runtime. Suggest `fromPromise` with a named error only when the workflow specifies a recovery decision; otherwise let the rejection reach the application error boundary. See [`../../kamae/error-handling.md` §fromSafePromise Misuse](../../kamae/error-handling.md).

## 3.2 Are error types Discriminated Unions? — Medium

For expected errors exposed in a `Result` or another public business contract, flag `Error` subclasses, free-form `string` error codes, or `Result<T, string>`. Suggest a Discriminated Union (`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`) so callers can branch exhaustively. Do not apply this rule to `Error` subclasses for unexpected faults or contract violations that propagate to the application error boundary.

Also flag: error DU variants where contextual data (IDs, codes, values that caused the error) exists only in a `message: string` field and is not exposed as typed fields. A `message` field itself is fine for logging or display, but when callers must parse it to extract values for branching or retry logic, the typed error has lost its purpose. Suggest adding the relevant context as named fields alongside `message`. See [`../../kamae/error-handling.md` §Error Type Design](../../kamae/error-handling.md).

## 3.3 Are Result chains used instead of nested if/else? — Low

Flag only an unnecessary unwrap followed by re-wrapping in the middle of composing expected decisions. In that case, cite the matching guide under `../../kamae/result-libraries/` and suggest the appropriate combinator. An immediate branch or match after the expected decision is complete is allowed, especially when crossing into native async persistence whose rejection must propagate.

Also flag: `andThen` / `map` callbacks exceeding ~5 lines or containing multi-branch if/else logic. This is procedural code wrapped in a Result combinator, not Railway Oriented Programming. Suggest extracting each logical step into a named function so the chain reads as a flat pipeline of operations. See [`../../kamae/error-handling.md` §Composing Operations](../../kamae/error-handling.md).
