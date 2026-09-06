# DMMF design scenarios

Status: authored scenarios, input preparation, and an exploratory execution runner.
The v0.1 rubric is uncalibrated and there is no automatic design grader.
The runner shares process/context utilities with the historical harness, but does
not use its generation prompts, acceptance checks, or grading/reporting logic.

Read the [Japanese scenario preview](REVIEW.ja.md) before execution.
The scenarios instantiate the [DMMF assessment proposal](../design-evaluation.md):
product behavior supplies domain meaning; functional test scores, defect counts,
and eligibility gates are not assessment inputs.

## Scenarios

| ID | Initial task | Withheld change | Design opportunity |
| --- | --- | --- | --- |
| [asset-loans](cases/asset-loans/PRD.md) | Request, approve, hand over, and return equipment | [Inspection after physical return](cases/asset-loans/CHANGE.md), including repair outcomes and earlier closed records | State-specific facts, transition contracts, issue workflow, and model evolution |
| [wholesale-quotes](cases/wholesale-quotes/PRD.md) | Issue a fixed quote for goods sold by count or weight, with discount and freight | [Accept the quote](cases/wholesale-quotes/CHANGE.md) through credit reservation, retaining quoted prices | Units, resolved quantities, typed pricing stages, calculations, and a new business stage |
| [parcel-dispatch](cases/parcel-dispatch/PRD.md) | Book, defer, and resume carrier A attempts | [Carrier B fallback](cases/parcel-dispatch/CHANGE.md), a different wire format, and persistent B resumption | State and recovery context, external conversion, effect composition, and changing integrations |

Each case contains neutral `PRD.md` and `HOST.md`, withheld `CHANGE.md` and
`HOST-CHANGE.md`, descriptive `case.json`, and evaluator-only `review.json`.
The host contract specifies wire data and available operations in prose; it
supplies no domain TypeScript types, error wrapper, implementation, or runtime
library. All cases use the same pinned Bun/TypeScript starter and task prompts.
Implementation organization and libraries remain candidate choices.

## Predeclared observations

`review.json` fixes the meaning, requirements, scope, question, and counterevidence
for each criterion × domain concept/path before candidate generation. Its unit
IDs persist across candidates. Requirement references locate the business meaning
under discussion; they are not assertions to execute or a checklist to score.

There are 20 observation units. D1–D6 inspect initial source; D7 inspects each
candidate's actual follow-up change. Wholesale quotation's initial D2 is explicitly
N/A: the initial task has no subsequent lifecycle operation. Its temporary pricing
stages belong to D4; acceptance introduces a lifecycle for observation under D7.
All other initial axes are applicable. An omitted implementation is U, not N/A.
Shared evidence across axes must be cross-referenced, not counted as separate bugs.

`rubric.md` is the verbatim v0.1 snapshot of
[`design-evaluation-draft.ja.md`](../design-evaluation-draft.ja.md) used by this suite.
Keep this snapshot, the case inputs, and review maps together when versioning the
suite; changes to the broader proposal do not silently change prepared packets.
Its ordinal judgments require declaration, construction, and actual-consumer
evidence, plus considered counterevidence. Do not produce totals or averages, infer
effectiveness from a library name, or infer D7 from an unchanged initial design.

The preparation check validates references and coverage, not the validity of a
design judgment. Behaviorally equivalent calibration controls and the calibrated
assessment procedure still need implementation and review before comparisons.

## Prepare without executing

From the repository root:

```sh
bun run benchmark:scenarios check
bun run benchmark:scenarios prepare --output /tmp/kamae-design-inputs
```

The parent output directory must exist and the output directory must be new.
Preparation refuses overwriting an earlier packet or writing within the authored
scenario directory. It invokes no model, installs no dependencies, executes no
candidate code, and writes no evaluation result. The CLI supports only `check`
and `prepare`; it has no `run` command. Do not pass these cases to the historical
`benchmark` or `benchmark:regrade` commands.

```text
manifest.json
generation/<case>/initial/
  PRD.md, HOST.md, DESIGN-TASK.md, IMPLEMENTATION-TASK.md
  package.json, bun.lock, tsconfig.json
generation/<case>/change/
  PRD.md, HOST.md, CHANGE.md, HOST-CHANGE.md, CHANGE-TASK.md
review/<case>/review/
  case.json, review.json, RUBRIC.md
  PRD.md, HOST.md, CHANGE.md, HOST-CHANGE.md
```

The manifest records file hashes, audience, and phase, with `status: prepared-only`
and `modelExecution: false`. These fields describe preparation, not run results.
Files are copied from explicit lists. Extra files in a source case directory
cannot enter generation packets implicitly. Reviewer-only edits alter review
hashes without altering generation inputs. Store any later run record separately.

## Execution protocol

Packet separation is not filesystem isolation. Never give a generation agent
access to the whole prepared output, this source tree, reviewer material, prior
results, or later changes during its initial task. An execution runner must provide
an isolated workspace containing only the selected phase's inputs, and establish
which personal instructions, tools, and skills can enter its context.

1. Freeze the reviewed suite and assign anonymous candidate IDs. Give both
   conditions identical initial packets, model settings, and toolchain; vary only
   the declared skill treatment. Skill loading is the runner's responsibility,
   not text hidden in a shared task prompt.
2. Run `DESIGN-TASK.md`, preserve the design and selected exact dependency versions,
   then use `IMPLEMENTATION-TASK.md` in a fresh session with that candidate's design.
   Preserve exact prompts, source, dependency files, and available execution logs.
3. Freeze the initial implementation before revealing any change. Add the selected
   change packet to a copy of that candidate's own implementation and run
   `CHANGE-TASK.md`. Keep its dependency files and prior source: the change packet
   is supplemental input, not another starter or a reference implementation.
   Keep the same declared skill condition. Preserve both versions and their diff.
4. Give reviewers anonymous source, before/after artifacts, and the review packet.
   Assess the predeclared units against the rubric with code evidence. Notes are
   claims to verify, not scores. Retain missing evidence as U and planned N/A;
   do not require a public API failure to recognize a missing design guarantee.

The preparation CLI alone does not implement these execution requirements.
The separate pilot runner implements the generation and snapshot steps below;
anonymous source review and calibration remain reviewer responsibilities.

## Exploratory pilot

```sh
bun run benchmark:design --model gpt-5.5 --reasoning-effort medium \
  --timeout-seconds 900 --output benchmarks/results/dmmf-pilot
```

This explicitly calls models. Each of the three scenarios gets one baseline and
one kamae candidate, each with fresh design, implementation, and change sessions.
Order alternates across scenarios. There are no automatic retries, score-based
selection, or post-generation repairs. An incomplete run retains its evidence;
execution status describes artifact production and protocol integrity, not design
application. This one-pair pilot is exploratory, not a calibrated comparison.

Real execution currently requires macOS. The outer OS sandbox denies reads of
personal instructions, the repository, evaluation packets, future changes, and
other candidate workspaces. Every phase has a loopback initial-context audit;
separate probes check workspace access and held-out material restrictions. The
same base-instruction/tool signature must remain across phases. As in the
historical isolation utilities, authentication stays in place and the actual
remote request is not captured. The environment is not a container and network
access remains available. See the [context limitations](../README.md#context-evidence-and-limits).

`run-manifest.json` records inputs, treatment, model settings, utility/source
hashes, and planned order. `runtime-source/` preserves the runner source. Per-phase
prompts, command arguments, context evidence, JSONL output, final messages, and
source snapshots are retained. `initial/` is saved before revealing the change;
`changed/` and `change-diff.stdout` retain the actual follow-up. Failed or incomplete
attempts retain `latest/` and any phase snapshots. Results are ignored by Git.

The runner installs the pinned toolchain and selected exact dependencies with
lifecycle scripts disabled. Design may choose dependencies; implementation keeps
that package and lockfile; change may add exact dependencies as documented in the
recorded prompt. It never runs acceptance checks or creates candidate test totals.
Candidate-driven development checks may appear in raw logs and are not assessment
inputs. Review source evidence even where an execution is incomplete; do not turn
execution status into a functional eligibility gate.

For a portable input-only check, add `--dry-run` and use a new output directory.
This makes no model calls or dependency installations. The execution CLI uses
[`codex exec` JSONL and ephemeral mode](https://learn.chatgpt.com/docs/non-interactive-mode);
the exact locally audited arguments are recorded with each phase.

## Validate tooling

```sh
bun run benchmark:typecheck
bun run benchmark:scenarios check
bun run benchmark:scenarios:test
```

The tests exercise packet boundaries, withheld changes, reference/coverage
validation, deterministic hashes, and refusal to overwrite source or prior output.
They do not implement the products, test candidate behavior, or award skill scores.
CI runs these checks without calling a model.
