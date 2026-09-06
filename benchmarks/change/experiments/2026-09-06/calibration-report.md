# Pre-generation calibration

The frozen protocol completed all six blinded controls before experimental
generation. Two independent critics and a fresh adjudicator assessed each actual
source change. Supervisory source audits checked the resulting counterexamples
and corrections against the hidden control contracts; no test or string-matching
rule assigned a quality outcome.

| ID | Disclosed control | Adjudicated outcome | Necessary correction |
| --- | --- | --- | --- |
| K001 | recovery reference | supported | None established |
| K002 | consumers broken | correction_needed | Restore the reservation event in the atomic commit payload |
| K003 | recovery broken | correction_needed | Classify unrecognized rejection as unknown, preventing unauthorized fallback and fabricated refusal context |
| K004 | intake broken | correction_needed | Sum canonical integer cents directly, without dividing the batch aggregate term by 100 |
| K005 | intake reference | supported | None established |
| K006 | consumers reference | supported | None established |

Both independent critics detected each of the three seeded root causes, and
neither critic proposed a necessary correction to the three reference changes.
Adjudication retained one cause per defective change and merged the duplicate
proposal. All controls passed the pinned TypeScript toolchain, independently of
these agent judgments.

There were 20 model sessions: 18 planned stages and two pre-registered bookkeeping
repair sessions for K002. Those repairs replaced a DIFF.patch evidence reference
with a production-source reference; the same event-omission cause remained.
Original critiques, adjudication, repair prompts, and replacement outputs are
retained. The provenance check found no input, context-signature, source-package,
raw-output linkage, or final bookkeeping errors at this point. The complete
experiment is still unfinished until its 72 planned changes are accounted for.

## Scope of the calibration judgment

This supports using the protocol for concrete necessary corrections and overall
implemented-change outcomes on this experiment. It does not establish universal
judge sensitivity or specificity. The three chosen defects are known positive
controls, not a random sample of programming errors, and the judges share a model
family.

The independent recovery audit found incomplete propagation of the known cause to
the per-requirement profile: K003's fabricated refusal can also corrupt a C2
deferred plan or a C5 abort context after a later save rejection, although those
rows were marked supported. These consequences are repaired by the same change;
they are not additional defects. Preserve the original assessment and the audit
supplement. Do not count supported requirement rows, sum obligation scores, or use
them as a release ranking. Compare established corrections and whole-change
outcomes, while reporting incomplete impact coverage as a judge limitation.

Source checks: [intake](calibration-intake-audit.md),
[recovery](calibration-recovery-audit.md),
[consumers](calibration-consumers-audit.md).
Raw assessments and source packages remain under calibration/K001–K006.
