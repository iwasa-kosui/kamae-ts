# Error Boundary Policy Design

## Goal

Align kamae-ts error-handling guidance with Domain Modeling Made Functional by distinguishing expected, decision-bearing failures from unexpected faults, while allowing narrowly defined local control-flow exceptions.

## Context

The current guidance states that domain code must not throw and presents repository failures as `Result` errors alongside business errors. This has two undesirable effects:

- It makes unexpected infrastructure failures appear to be business decisions that every caller must handle.
- It prohibits all use-case exceptions, including assertion failures and intentionally private control-flow exceptions.

The replacement policy must preserve exhaustive handling of expected business failures without converting outages, defects, and broken internal contracts into domain values.

## Decisions

### 1. Classify failures by the decision they require

The guidance will define four normative categories.

| Category | Definition | Representation | Responsibility |
| --- | --- | --- | --- |
| Expected domain failure | A foreseeable business or validation outcome for which the caller has a domain decision. | `Result<T, DomainError>` | The caller exhaustively handles the error union. |
| Recoverable external failure | An external-system failure for which the domain has a specified recovery, fallback, retry, or deferral decision. | `Result<T, ExternalServiceError>` | The caller makes that specified business decision. |
| Unexpected infrastructure fault | An outage, configuration defect, authentication failure, malformed third-party response, or unknown SDK error without a specified domain recovery. | thrown error or rejected promise | The application error boundary records context and produces the operational failure response. |
| Contract or invariant violation | A broken programmer assumption, impossible state, failed assertion, or exhaustive-match failure. | thrown error | The error is allowed to propagate to monitoring and must not be translated into a domain error. |

The decisive question is not the technical source of the failure but whether a consumer has a defined domain decision to make. An external timeout may be a recoverable external failure in one workflow and an unexpected fault in another.

### 2. Preserve a strict boundary for expected errors

Expected domain failures remain explicit `Result` unions. State transition failures, validation failures, and business-rule failures must not be thrown. Error unions stay use-case-specific and are translated to transport responses only at the controller or other delivery boundary.

Repository and gateway examples must not use a catch-all `RepositoryError` with `cause: unknown` as a default `Result` member. A gateway returns `Promise<T>` when it can only fail unexpectedly. It returns `Promise<Result<T, ExternalServiceError>>` only when its named external failure has a documented, workflow-specific recovery.

### 3. Let unexpected faults propagate across module and async boundaries

Unexpected infrastructure faults and contract violations may cross function, module, and asynchronous boundaries. They are not caught simply to convert them to `Result`, and they are never added to a domain-error union merely for uniformity.

Application composition, framework middleware, jobs, or other delivery boundaries are responsible for logging, tracing, alerting, and producing a generic operational response. The domain and use-case guidance must not prescribe a specific web framework implementation.

### 4. Allow local control-flow exceptions as a separate, narrow technique

Private control-flow exceptions are permitted only when they improve clarity over a `Result` pipeline. They are distinct from the two fault categories above and must meet all of these conditions:

- The thrown sentinel is private to the implementation and is not part of a public type or error union.
- A clearly associated boundary catches it and returns the documented public result.
- The catch distinguishes the sentinel from other errors and rethrows every non-sentinel error unchanged.
- The sentinel represents control flow, not a validation, state-transition, or other expected business failure.

The catch may be in another function or module when that module is the explicit private control-flow boundary. The guidance will therefore not impose a same-function or synchronous-only restriction. The documentation will nevertheless prefer explicit `Result` composition when it is equally clear.

### 5. Make review guidance classification-based

The kamae-review checklist will replace the blanket rule "flag every `throw` in entity, value object, or use case" with classification questions:

1. Is this an expected domain failure? If yes, require `Result`.
2. Does an external failure have a documented business recovery? If yes, require a named error in `Result`.
3. Is this an unexpected fault or failed contract? If yes, allow propagation and reject conversion into a catch-all domain error.
4. Is this a private control-flow sentinel? If yes, verify containment, explicit discrimination, and rethrow of non-sentinels.

## Documentation and Example Scope

The source-of-truth changes cover `skills/kamae/SKILL.md`, `skills/kamae/error-handling.md`, all four result-library guides, `skills/kamae/state-modeling.md`, and `skills/kamae-review/checklist/error-handling.md`.

The public documentation must remain synchronized: both READMEs; English and Japanese error-handling, code-review, and state-modeling pages; and the English and Japanese result-library pages. No ADR change is required because the existing ADRs concern evaluation infrastructure rather than error-policy decisions.

## Evaluation Strategy

The evaluation suites will establish the policy through separate task-scoped cases rather than a suite-wide ban on `throw`.

- Keep a violation that throws expected business failures and require reviewers to request `Result`.
- Replace the generation task that demands no throws with one that requires expected business errors in `Result` and excludes a catch-all `RepositoryError` from the domain-error union.
- Add a clean review fixture with a private control-flow sentinel, an explicit discriminating catch, and rethrow of unknown errors.
- Add a review violation fixture that converts an unexpected external outage into an undifferentiated `RepositoryError` in a use-case error union.
- Remove the global `no_thrown_exceptions` grader because it invalidates permitted assertion and control-flow exceptions.

The existing runner already supports task-scoped graders, so no runner change is needed. After the dry-run validation, both real-model suites must be run because this is a change to skill prose and graders.

## Non-Goals

- Do not standardize a logging framework, web framework, or global error middleware implementation.
- Do not make all external failures exceptional; documented recovery decisions remain modelled errors.
- Do not weaken the ban on exceptions for expected domain or validation failures.
- Do not use this policy to permit swallowed exceptions or catch-all conversion to `Result`.

## Acceptance Criteria

1. The canonical skill documents all four failure categories and their ownership.
2. Examples distinguish expected domain errors from unexpected infrastructure faults.
3. A contained local control-flow exception is allowed by the review guidance, while a thrown business failure remains a finding.
4. A failed assertion and an unknown external fault are allowed to propagate and are not prescribed as domain `Result` members.
5. English and Japanese public documentation express the same policy.
6. Both eval suites pass dry-run validation and real-model evaluation with an aggregate score of at least 0.7.
