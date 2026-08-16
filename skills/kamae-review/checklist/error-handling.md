# Error Handling Checklist

Reference: [`../../kamae/SKILL.md` §3](../../kamae/SKILL.md), [`../../kamae/error-handling.md`](../../kamae/error-handling.md), and the project's Result library guide under [`../../kamae/result-libraries/`](../../kamae/result-libraries/).

## 3.1 Does each failure cross the boundary appropriately? — Medium

Classify an observed `throw` or caught error before reporting it:

1. Is it an expected validation or business-state failure? It must be returned as a use-case-specific `Result` error.
2. Is it an external failure with documented recovery? Model that named, recoverable failure in `Result` rather than throwing it.
3. Does the code wrap an unclassified fault as `RepositoryError` with `cause: unknown` and add it to a domain union? Flag it: unknown infrastructure faults should propagate to the application error boundary instead of becoming catch-all domain errors.
4. Is the exception only a private local-control-flow sentinel, caught by its associated boundary after discriminating `unknown` and rethrowing every other value? Do not report it.

| Observed failure | Review action |
| --- | --- |
| Expected validation or business-state failure is thrown | Medium: require a use-case-specific Result error |
| External failure has a documented recovery but is thrown | Medium: model the named recoverable failure in Result |
| Unknown outage, config defect, or assertion is wrapped as RepositoryError | Medium: allow propagation instead of a catch-all domain error |
| Private sentinel is caught by its associated boundary and rethrows unknown errors | No finding |

Do not report `throw` inside `assertNever`, a failed internal assertion that is allowed to propagate, or an unexpected fault that is allowed to reach the application error boundary. Converting an assertion into a catch-all `Result` error remains a Medium finding.

## 3.2 Are error types Discriminated Unions? — Medium

Flag: `Error` subclasses, free-form `string` error codes, or `Result<T, string>`. Suggest a Discriminated Union (`{ kind: "DriverNotAvailable"; driverId } | { kind: "RequestAlreadyAssigned" }`) so callers can branch exhaustively.

## 3.3 Are Result chains used instead of nested if/else? — Low

Verify that the project uses the matching Result library API (`.map`, `.andThen`, `Result.do`, …) rather than unwrapping immediately into branching code. Cite the matching guide under `../../kamae/result-libraries/` for the correct combinator.
