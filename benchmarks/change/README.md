# Implemented-change benchmark

This experiment tests whether skill updates improve actual modifications of
existing applications. It uses three fixed before/after tasks, a no-skill baseline,
and the exact v1.0.0–v1.4.0 Git snapshots. It does not score source strings,
acceptance-test totals, architectural vocabulary, or adherence to a preferred
internal design.

The default plan has 72 implementations: three cases × six conditions × four
repetitions. Every case/repetition block contains each condition once; condition
positions are counterbalanced across blocks. Anonymous IDs are shuffled separately
from generation order. The default generator is gpt-5.5 at medium effort; both
independent critics and the fresh adjudicator use gpt-5.5 at high effort. Every
session has the same 1,200-second deadline. These are descriptive comparisons
over deliberately selected situations, not a general model or skill ranking.
See [task sensitivity](SENSITIVITY.md) for the distinction between satisfying these
contracts and demonstrating the incremental benefit of a release update.
The completed [September 2026 comparison](experiments/2026-09-06/README.md)
includes all 72 delivered sources, primary outcomes and supplemental audits.

## Cases and product obligations

| Case | Actual requested change | Observable consequences |
| --- | --- | --- |
| intake | Add a second wire representation with decimal amounts and transformed/defaulted dates | Existing single and batch consumers retain canonical storage, errors, partial success, and correct aggregates |
| recovery | Add fallback, deferral, and resumption across two carriers | Correct recovery authority, persisted carrier/reason context, effect order, and explicit privacy/diagnostic obligations |
| consumers | Add consumers with restricted host capabilities and an alternate storage provider | Public callers work with only supplied resources, old reservation semantics remain, and atomic outbox writes survive adapter translation |

`API.md` describes the correct starter. `CHANGE.md` defines preserved B obligations
and new C obligations. Only these documents create product requirements. The
reviewer's instruction to inspect a failure path does not create new product
logging, concurrency, rollback, or validation requirements.

Each case includes a complete reference change and a variant containing one
material behavioral defect. Both must typecheck; that demonstrates why typechecks
alone are not the assessment. Control metadata is withheld from judges. Reference
code is never provided to experimental generators or reviewers.

## Frozen inputs and calibrated judges

```sh
bun install --frozen-lockfile
bun run benchmark:typecheck
bun run benchmark:change:test
# Install pinned starter dependencies once, creating no unpinned dependencies.
(cd benchmarks/change/cases/intake/starter && bun install --frozen-lockfile --ignore-scripts)
(cd benchmarks/change/cases/recovery/starter && bun install --frozen-lockfile --ignore-scripts)
(cd benchmarks/change/cases/consumers/starter && bun install --frozen-lockfile --ignore-scripts)
bun run benchmark:change prepare --output benchmarks/results/change-experiment
bun run benchmark:change calibrate --output benchmarks/results/change-experiment
```

Preparation saves the exact cases, controls, tagged skill/rule trees, rubric,
prompts, schemas, model/settings, and executable runner sources, including shared
helpers. SHA-256 comparisons fail closed if any frozen artifact or executing
protocol changes. Case definitions and controls require source review before
preparation. `--dry-run --refs baseline,HEAD --runs 1` prepares the inputs without
invoking a model; dry-run manifests cannot later invoke models.

Each candidate receives two independent source reviews, followed by a new
adjudication session. Critics cannot read each other's work. The adjudicator is
instructed to read the source first, then challenge both critiques. This ordering
is a prompt instruction, not an externally enforced proof of reading order.
Each finding needs an obligation, source lines, permitted counterexample, actual
and required behavior, consequence, counterevidence, and minimal correction.
Duplicates are merged and unsupported claims rejected.

Before generation, a human or supervising agent must inspect all calibration
assessments against the source and hidden `controls/control.json` contracts. Save
`calibration-signoff.json` with `accepted: true`, an explanation of the calibration
decisions, `rubricHash` from the manifest, `manifestHash` (SHA-256 of manifest.json
bytes), and `reviewHashes` mapping every calibration ID to the SHA-256 of its
final.json bytes. This signoff is an explicit source judgment, never an automatic
keyword match. If calibration fails, preserve the results, correct the protocol
or fixtures, and prepare a new experiment before generating experimental outputs.

## Generation and assessment

```sh
bun run benchmark:change generate --workers 4 --output benchmarks/results/change-experiment
# May run concurrently with generation in another terminal.
bun run benchmark:change review --watch --workers 4 --output benchmarks/results/change-experiment
bun run benchmark:change report --output benchmarks/results/change-experiment
bun run benchmark:change verify --output benchmarks/results/change-experiment
```

Generators actually edit the supplied source. Skill conditions receive only the
selected release's guidance; the baseline receives none. Fixed package/config,
specification, and guidance files cannot change. Implementers may validate their
own changes, but tests and typecheck outcomes are withheld from quality reviewers.
Review packages contain exact production source before and after, a diff, the
fixed product contracts, dependencies, and notes with explicit release/guidance
names masked. Source bytes remain exact, so coding style or an accidental source
comment can still reveal clues about authorship. Blinding does not guarantee that
reviewers cannot guess the condition.

Primary judgments for every obligation and complete implementation are
`supported`, `correction_needed`, or `unverified`. There is no numeric quality
scale. Supported means no necessary correction was established from the inspected
contract; it is not proof of defect-freedom. Reports show cases separately and
retain every planned run in the denominator. Generation/review failures are
separate from supported work and unresolved judgments. No quality-dependent
retry or model substitution is permitted. One separate bookkeeping repair session
is permitted per review stage and its original output is retained.

The bookkeeping validator checks references and internal decision consistency;
it does not judge the truth of a finding. Harness tests validate that mechanism,
input isolation, and experimental accounting, never the candidate's code quality.
The September 2026 experiment added a [supplemental blind source audit](SUPPLEMENTAL-AUDIT.md)
after a primary judge accepted a false language-semantics claim. That disclosed
extension applies to every delivered implementation and preserves both sets of
outcomes; it is not a preregistered part of the primary CLI protocol. An ordinary
primary report alone must not be described as that supplemental audited result.
Generation and review evidence is retained even on failure. A process killed
outside the runner can leave `running` artifacts; these are not automatically
retried or converted to successful results.

macOS sandbox isolation denies personal skills/instructions and other experiment
artifacts. Every session saves a loopback preflight of CLI context construction;
this is not a captured copy of the remote model request. `--isolation audit` lacks
the OS boundary and should not be treated as an equivalent isolation experiment.
Using the same model family for critics and adjudication can preserve correlated
blind spots. Calibration detects the chosen known defects; it does not establish
universal judge sensitivity or specificity.
