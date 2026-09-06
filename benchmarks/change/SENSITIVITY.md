# What this experiment can distinguish

This is an interpretation of the fixed task design, not an additional grading
rubric. It was written after generation started. It must not change candidate
outcomes, introduce new obligations, or imply that any condition ought to win.

The experiment asks whether adding a release's generation guidance changes the
rate of source-established necessary corrections when a model modifies these three supplied
applications. It does not measure the review skill, long-term maintenance cost,
or the benefit of guidance for all server-side TypeScript work.
All conditions start from the same hand-authored starter. The study therefore
does not observe how design choices made under an earlier skill condition affect
the cost or correctness of a subsequent change to that condition's own code.

## The starter already supplies some of the relevant design

The intake starter's `validation.ts` already turns an unknown wire value into a
canonical `OrderInput`. Both `single.ts` and `batch.ts` call that parser, and batch
summaries use successfully saved canonical response bodies. Adding a second wire
format and a context argument exercises normalization and consumer compatibility,
but it does not force the implementer to discover a missing normalization boundary
or repair duplicated input/output types across several existing consumers.
Consequently, this task can detect incorrect conversions or propagation, while
remaining a weak test of the incremental value of v1.2's schema-derived typing.
A correct manual conversion must receive the same outcome as a correct schema
transform; otherwise the assessment would reward the prescribed technique.

The consumers starter already creates the reservation state change and its event
in one `commitReservation` call. A provider adapter can preserve that workflow.
The change contract explicitly identifies each new consumer's available host
methods. This tests actual capability compatibility and preservation of atomic
writes, but does not require discovering those constraints in an unfamiliar
application or paying the later cost of an earlier dependency design.

Recovery adds more new control flow: carrier authority, saved resumption state,
failure classification, context retention, and diagnostic effects. Its contract
also provides detailed policies and examples. It can expose missing or incorrect
branches, but success on that bounded specification does not establish reliable
recovery design when business policy must first be elicited or reconstructed.

## A tied outcome has several possible explanations

A model may already solve the selected tasks without guidance. The supplied
starter and explicit contracts may remove much of the difficulty that the updated
guidance addresses. Judges may still miss defects despite calibration and source
audits. These explanations can coexist. Equal outcomes alone cannot identify
which explanation dominates, and cannot establish that the skill has no value.
The treatment is a whole release snapshot. Even an observed difference cannot
identify which individual instruction caused it; the release hypotheses explain
task selection, not an isolated causal mechanism. Four repetitions per
case/condition are insufficient to establish equivalence or resolve small effects.

Conversely, a structurally complete agent assessment is not automatically sound.
Its references and obligation accounting can be valid while its language-semantics
claim is false. Calibration with three chosen defective controls demonstrates
recognition of those defects, not general sensitivity or specificity. The
supplemental audit challenges actual claims and inspects supported candidates,
but retains the limitations documented in `SUPPLEMENTAL-AUDIT.md`.

More independent task families and changes following an earlier implementation
would be needed to study maintenance consequences. Such a future experiment
should fix its task selection and obligations before evaluating release outputs,
preserve a no-skill baseline, and report unresolved judgments and execution
failures. It should not keep modifying a task until a preferred release wins.
