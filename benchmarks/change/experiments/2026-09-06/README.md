# v1.0–v1.4: actual changes and corrective source assessment

The experiment did not demonstrate a progressive release benefit or an incremental
correctness benefit over the no-skill baseline on these tasks. All 72 changes were
implemented and received the supplemental source audit. One v1.0.0 implementation
needed a concrete correction; no necessary correction was established in the other
71 implementations. This is a descriptive finding for these tasks and this model,
not proof that the skill has no benefit or that the conditions are equivalent.

## Final source assessments

Cells show supported implementations / planned implementations. Supported is an
agent judgment that no necessary correction was established, not a test score.

| Condition | Intake | Recovery | Consumers | Supported / planned | Correction needed | Unverified |
| --- | --- | --- | --- | --- | --- | --- |
| No skill | 4/4 | 4/4 | 4/4 | 12/12 | 0 | 0 |
| v1.0.0 | 4/4 | 4/4 | 3/4 | 11/12 | 1 | 0 |
| v1.1.0 | 4/4 | 4/4 | 4/4 | 12/12 | 0 | 0 |
| v1.2.0 | 4/4 | 4/4 | 4/4 | 12/12 | 0 | 0 |
| v1.3.0 | 4/4 | 4/4 | 4/4 | 12/12 | 0 | 0 |
| v1.4.0 | 4/4 | 4/4 | 4/4 | 12/12 | 0 | 0 |

The frozen primary judgments remain separate. Their three correction-needed
judgments contain one confirmed cause and two subsequently rejected claims.

| Condition | Primary supported | Primary correction needed | Primary review failed |
| --- | --- | --- | --- |
| No skill | 10 | 1 | 1 |
| v1.0.0 | 10 | 2 | 0 |
| v1.1.0 | 12 | 0 | 0 |
| v1.2.0 | 12 | 0 | 0 |
| v1.3.0 | 12 | 0 | 0 |
| v1.4.0 | 12 | 0 | 0 |

The lone observed defect does not establish that a later instruction fixed its
cause: the baseline also had no established correction, the treatment is a whole
release, and each case/condition has only four runs. A ceiling in the chosen tasks
and unmeasured judge misses remain possible alongside a small or absent marginal
effect in this setting. Replacing the old scoring approach with source assessment
did not produce evidence of a release-by-release improvement.

## Experiment

All 72 implementations were delivered: three existing applications, six guidance
conditions, and four repetitions per case/condition. Conditions were no skill and
the exact v1.0.0, v1.1.0, v1.2.0, v1.3.0, and v1.4.0 Git snapshots. The benchmark
started from origin/main at `a65a117aad1d3831cc7b855bb3d9af377188a8e4`.

| Case | Change actually implemented | Release hypothesis |
| --- | --- | --- |
| intake | Add decimal-money/date-component input and defaults while preserving existing single/batch consumers and canonical storage | v1.2 boundary input/output handling and existing-code adaptation |
| recovery | Add carrier fallback, deferred plans and JSON resumption with failure context and committed diagnostics | v1.1 context retention, v1.3 recovery classification, v1.4 state/time handling |
| consumers | Add read-only and append-only consumers plus an alternate storage backend while retaining atomic reservations/outbox | v1.4 consumer capability contracts and adapters |

These hypotheses explain task selection. Conditions contain whole release
snapshots; this is not an ablation that identifies the effect of one instruction.

The generator was `gpt-5.5` at medium effort. Each implementation received two
fresh independent `gpt-5.5` critics and then a fresh `gpt-5.5` adjudicator at high
effort. Each CLI session had the same 1,200-second deadline. Implementation and
primary-review processes each used six workers. The prepare manifest records its
default of four; the actual invocation overrides are separately disclosed in
`metadata.json`. CLI version was 0.150.1, Bun 1.3.14, and TypeScript 5.9.2.

Case/repetition blocks contained every condition once, with condition positions
counterbalanced across blocks. Anonymous candidate IDs were shuffled separately
from generation order. Inputs, tagged guidance, prompts, rubric, schemas and
executable runner sources were frozen before generation. macOS filesystem
isolation denied personal guidance, other candidates and experiment artifacts.
The context evidence is a local loopback preflight, not a recorded remote request.

The quality judgment is whether a necessary correction can be established from
the full source and the product contract. Findings must show a permitted
counterexample, actual and required behavior, source evidence, consequence,
counterevidence and minimal correction. Test results, string matches, architecture
vocabulary, preferred techniques and module counts do not assign quality outcomes.

## Calibration and correction of the judges

Before generation, both critics found all three seeded causes and found no
necessary correction in the three reference changes. The adjudicators retained
those outcomes. Supervisory source audits checked the actual causes and found
that one recovery cause affected more obligations than its primary profile listed.
Those extra consequences are not extra independent defects. All six controls
typechecked; typechecking was not their quality assessment.

Primary judgments for C021 and C069 claimed that a decimal regex without the `m`
flag accepted a trailing newline. The supplemental source audit rejected these
claims. ECMAScript's `$` assertion only succeeds before a line terminator when
Multiline is enabled; otherwise it requires the actual input end. The proposed
inputs therefore fail these parsers before repository access.
[ECMAScript specification](https://tc39.es/ecma262/multipage/text-processing.html#sec-compileassertion).

The supervising agent initially repeated the C021 error, then explicitly retracted
it after an independent audit checked the language specification. The original
primary judgments remain in the candidate records. Structural JSON validation
did not establish the truth of those findings.

After C021, the experiment added the same supplemental source audit to every
implementation, including primary supported outcomes. This was a disclosed
post-start extension, not a preregistered part of the primary protocol. Three
case-specialist auditors were blind to condition mappings and read all source and
requirements. They retained context across candidates and had prior control
authoring/audit exposure. They did not execute candidate code or tests. Their
assessments and primary outcomes are separate fields in each candidate record.

C052's primary adjudicator failed because the selected model was at capacity.
It was not retried or replaced with another model. Its completed source package
was intact, so the uniform supplemental audit could still assess the implementation.
The primary failure remains a failure and stays in the planned denominator.

## Established necessary correction

C040 (v1.0.0, consumers) mixes unvalidated successful Provider B data with the
internal string sentinel `"missing"`. `readProviderBEnvelope` returns both a
successful envelope's `value` and that sentinel through the same untagged result.
The adapter checks the sentinel before validating a row.

For the permitted malformed response `{ ok: true, value: "missing" }`, an
availability query therefore returns 404 instead of 500. During a reservation
lookup, the same value can instead authorize the subsequent stock lookup and an
atomic reservation batch, where the contract requires stopping with 500. Both
the primary assessment and supplemental source audit establish this path from
`reservation.ts:208`, `:255` and `:262` into the reserve flow at `:102`.

One sufficient correction is to require an object row on the successful-envelope
branch before returning its value. A tagged result would also prevent the
collision, but is not the only acceptable correction. This is one cause affecting
C3/C6/C7, not three independent defects and not a penalty for omitting a preferred
type pattern. The observed source remains unchanged in
[C040's evidence](candidates/C040.json).

## Inspect the evidence

`candidates/Cxxx.json` contains the exact delivered production source as JSON
strings, implementation notes from the blinded package, the original primary
assessment, the supplemental assessment, condition mapping and artifact hashes.
The shared before-source and product contracts are under `../../cases/`.
For example, read one exact source file without executing the implementation:

```sh
bun -e 'const c = await Bun.file(process.argv[1]).json(); process.stdout.write(c.source[process.argv[2]]);' candidates/C021.json after/src/validation.ts
```

`metadata.json` records the plan and frozen hashes; only the local output path is
omitted from this portable manifest copy, whose original-byte hash is retained.
`audited-summary.json` contains per-condition and per-case counts and individual
outcomes. `calibration/` preserves six structured control assessments, with the
reference and defective sources under `../../cases/*/controls/`.

Complete CLI transcripts, context probes, independent critic outputs, repairs,
test/tool logs and original source packages remain in the ignored local archive
`benchmarks/results/change-v1.0-v1.4-20260906/`. They are not all duplicated in this
portable evidence set. The export does not claim that omitted raw data is present.
`analysis-source/` contains exact snapshots of the local aggregation, integrity
inspection and export scripts, with hashes in metadata. Their relative paths and
`import.meta.dir` assume execution in that original archive, not in this document
directory. They are retained for inspection; candidate outcomes come from the
authored agent judgments, not source-pattern or test scoring in those scripts.

## Verification and execution accounting

The 316 model stages comprise 72 implementations, 216 planned primary review
stages, eight primary bookkeeping repairs, and 20 calibration stages (18 planned
plus two bookkeeping repairs). There were 315 clean completions and the one C052
capacity failure. Bookkeeping repairs retained the substantive findings/outcomes;
the original outputs remain archived. No quality-dependent generation retry,
primary model substitution, or repair of the observed candidate code occurred.

Frozen [verification.json](verification.json) reports `passed: false` because it
requires every stage to complete cleanly. Its sole error is C052's failed
adjudicator; no frozen-input, context-signature, source-package, output-linkage or
judgment-bookkeeping error was reported. It must not be presented as a blanket
passing verification. [Accounting verification](accounting-verification.json)
separately records complete accounting and matching source provenance, including
the failed review's package, while preserving `allExecutionsClean: false`.
[The failure evidence](failed-stage-evidence.json) retains the capacity error.

All 72 supplemental records passed source-reference/obligation bookkeeping checks.
All 78 review packages (72 experimental and six calibration) matched their source
inputs. Static inspection of production imports found no runtime source excluded
by test filenames in any of the 72 deliveries. All 60 treated implementations had
the full selected SKILL.md in a successful tool result; the 12 baseline inputs had
no guidance files. These checks establish delivery and record consistency, not
attention, guideline adherence or semantic correctness by themselves.

## Interpretation limits

Supported means no necessary correction was established from the inspected
contract; it does not prove defect-freedom. Four repetitions on each of three
selected tasks do not make the tasks representative of TypeScript development.
Nor do they establish equivalence or reliably resolve small differences between
conditions. The measured outcome is a source-established need for correction,
not a known true defect rate or a measured false-negative rate.
The generator and primary judges share a model family. Known-control calibration
does not establish general judge sensitivity or specificity.

The supplied starter already has useful normalization and atomic-write boundaries,
and the product contracts give detailed policies and integration surfaces. All
conditions modify the same hand-authored starter. This does not measure how
earlier design choices produced by each condition affect later maintenance.
See [task sensitivity](../../SENSITIVITY.md) and the
[supplemental protocol](../../SUPPLEMENTAL-AUDIT.md).
