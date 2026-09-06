# Evaluating DMMF design application

Status: evaluation proposal, not an implemented or calibrated grader.

The detailed [Japanese rubric draft](design-evaluation-draft.ja.md) defines
assessment units, four-level anchors for each criterion, evidence records, and
calibration contrasts. This document provides the rationale and source observations.

## Purpose

Kamae teaches functional domain modeling in server-side TypeScript. Evaluate how
generated code applies those design techniques. Satisfying the requested product
behavior is the premise of the task, not the capability this evaluation measures.
Do not add functional acceptance scores, correctness reviews, or acceptance gates
to this skill assessment. Product requirements supply the meaning of domain
concepts and rules; they are not a checklist for a second functional assessment.

This evaluates application of a chosen design approach. Conformance does not
prove universal code quality, lower maintenance cost, or superiority to every
other approach; those claims need separate evidence.

Scott Wlaschin's *Domain Modeling Made Functional* (DMMF) connects domain language,
types, invariants, workflow composition, explicit errors, serialization,
persistence, and design evolution. The publisher's [description and contents](https://pragprog.com/titles/swdddf/domain-modeling-made-functional/)
provide the source map below. The procedure and TypeScript examples are proposals
for this repository, not a rubric supplied by the author.

## Lessons from the rejected PRD benchmark

The earlier experiment built a common API test suite and automatic totals before
establishing how to distinguish design application. Its acceptance totals were
subsequently withdrawn as evidence of design quality. Reframing the same checks
as a minimum gate or a diagnostic sidebar does not answer the evaluation question.
This proposal previously repeated that framing; it is withdrawn here too.

The first protocol also supplied libraries, TypeScript shapes, and design topics
that could prime the baseline toward kamae. Removing that priming and improving
context isolation in the second protocol did not fix the measurement problem.
Nor did a working harness, successful CI, more runs, or precise usage accounting.

Establish the distinctions the assessment must recognize before implementing a
grader or launching comparisons. Historical source can help expose those
distinctions, but previous scores and reports are not validated design judgments.
Keep this history, reviewer criteria, and prior designs out of baseline inputs.

## Criteria and evidence

| Criterion | DMMF topic | Evidence to inspect in TypeScript |
| --- | --- | --- |
| Domain concepts | Domain Modeling with Types | Meaningful values and identities have distinct contracts used by actual consumers. An `EmployeeId` alias to `string` alone does not prevent passing an expense ID. |
| Invariants and state | Integrity and Consistency; Modeling Workflows as Pipelines | States carry their required data; constructors and transition contracts enforce the constraints. A paid expense without a receipt should not be a valid internal value. |
| Validated boundaries | Integrity and Consistency; Serialization | External representations become validated domain values. Follow API and persistence inputs into the core; a declared schema earns no credit if callers bypass its output. |
| Workflow composition | Modeling Workflows as Pipelines; Composing a Pipeline | Step contracts express meaningful inputs, outputs, and progression in an actual workflow. A helper named `validate` returning the same unconstrained type provides little evidence. |
| Pure decisions and effects | Composing a Pipeline; Persistence | Decisions operate on explicit values. Locate storage, gateway, clock, and randomness access. Passing a repository to every function does not make the core pure. |
| Explicit domain failures | Working with Errors | Expected failures form useful error alternatives that compose through callers. Inspect information retained for handlers; wrapping every fault in a generic `Result` is insufficient. |
| Evolution of the model | Evolving a Design and Keeping It Clean | Perform a specified follow-up change. Trace how the model, compiler feedback, and affected consumers guide it, and whether business rules remain centralized. |

The author's [illegal-states article](https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/)
illustrates why representable values matter. A union whose alternatives still
contain every optional field may resemble the technique without encoding its
constraint. Inspect allowed values and operations, rather than union syntax alone.

The author's later [dependency discussion](https://fsharpforfunandprofit.com/posts/dependencies/)
supports examining pure decisions and effect boundaries. It does not require
abstracting every pure helper. A clock value captured for a decision can be
appropriate while an external call remains necessary between workflow stages.
Explain the boundary and its reason from the code.

## Assessment procedure

1. Before generation, choose cases with explicit opportunities for these criteria.
   Freeze applicability and expected design guarantees. Do not require every
   technique in every task. Specify a follow-up change in advance and apply it
   to each candidate's own initial implementation.
2. Give conditions the same product task, starting tools, model, and settings;
   vary the declared skill treatment. Keep evaluator-specific criteria out of
   the shared generation prompt. Preserve exact inputs and generated source.
3. Review source under anonymous condition IDs. Inspect types, constructors,
   callers, and composition. Implementation notes are claims to verify. Coding
   style can reveal condition clues, so anonymity is not perfect blinding.
4. For each criterion record its guarantee, file/line evidence, a permitted misuse
   or change scenario, prevention mechanism, bypasses, and counterevidence.
   If needed, probe the specific type claim, such as whether an internal paid
   value can omit its receipt. This directly examines a design mechanism; it is
   not a general compilation or product-acceptance gate.
5. Judge `absent`, `nominal`, `partial`, or `established`: no mechanism; surface
   adoption without the guarantee; a guarantee with demonstrated gaps; or a
   guarantee supported across relevant paths. Use `unverified` for insufficient
   evidence. Keep predefined non-applicability separate.
6. Calibrate on behaviorally equivalent controls with different design guarantees,
   including superficial pattern adoption. Require independent review and
   resolution of disputed evidence before reporting comparisons.

For example, two implementations can implement payment successfully. One exposes an internal
`Expense` with optional `receiptId`; another requires a validated receipt to
construct `PaidExpense` and restricts payment to an approved state. The invariant
criterion should distinguish them without needing a reproduced public API bug.
An unused `PaidExpense` type beside an unrestricted production path does not
establish that guarantee.

### Concrete contrasts from historical source

The following observations come from reading the first pair in the local
`neutral-v2-os-gpt55` artifacts. Paths below are relative to each run's
`workspace/src/`. This is an exploratory inspection with condition labels known,
not a blind assessment, a calibrated result, or a claim about every generated
implementation. No acceptance results enter these observations.

| Source evidence | Design distinction to assess |
| --- | --- |
| `01-baseline`: `index.ts:3` defines one `StoredExpense` with optional `receiptId`; `index.ts:404` checks the receipt at runtime when parsing paid data. | Validation exists, but its state-specific knowledge is not retained in the returned type. A reviewer must distinguish runtime checks from a type-level invariant without claiming that the API fails. |
| `01-kamae`: `domain/expense.ts:41` requires `ReceiptId` in `PaidExpense`; `domain/expense.ts:104` accepts `ApprovedExpense` and `ReceiptId`; `use-cases/pay-expense.ts:62` actually calls that transition after narrowing and parsing. | The state model, transition contract, and production caller jointly demonstrate application. The type is not merely an unused declaration. |
| `01-kamae`: `use-cases/pay-expense.ts:24` defines a specific error union, but `index.ts:20` widens the shared handler input to `{ kind: string }`, and `index.ts:101` supplies a default branch. | Explicit error alternatives exist locally, while their exhaustiveness information is lost at the handler. Merely finding `Result` would miss the gap. |

These observations identify separate guarantees, not an overall winner. For
example, the typed transition does not itself establish reviewer authorization:
`use-cases/approve-expense.ts:32` checks the actor, while
`domain/expense.ts:76` accepts an `EmployeeId`. Name the particular guarantee
being assessed instead of asserting that all business rules are encoded in types.

Adapt the assessment to TypeScript: inspect ordinary typed construction, exports,
mutation paths, and actual uses of `any` or assertions. Do not infer runtime
immutability from `readonly` or protection from an unused brand. Assess bypasses
in submitted code rather than assuming every consumer escapes the type system.

Kamae-specific conventions such as `kind` spelling, companion objects, file
placement, library preferences, and `Sensitive<T>` are not automatically DMMF
criteria. Assess those separately against explicit skill objectives. Pattern,
file, and keyword counts cannot establish a design guarantee.

## Reporting

Report criterion judgments with evidence, applicability, and unresolved counts.
Preserve every planned generation, including missing or incomplete work. Separate
actual follow-up change results from initial-design observations; without a
performed change, evolution remains unverified. Do not introduce a weighted total
or claim a calibrated scale before validating this rubric.

The review package and comparison report contain design evidence and judgments,
not acceptance-test outputs, pass counts, or functional defect tallies. Do not
require a demonstrated API defect before recognizing a missing design guarantee.
Conversely, do not manufacture a high rating from an unused type, omitted domain
logic, or missing source; describe the actual evidence or its absence directly.

The current runner and manual review template do not implement this procedure.
Historical acceptance results are not a basis for this evaluation, including as
an eligibility gate. Any assessment of old source under this proposal is a new
exploratory analysis. Before a new comparison, confirm that calibrated reviewers
can distinguish absent, superficial, partial, and consistent application on the
same behavioral task. Only then implement and freeze the grading procedure.
