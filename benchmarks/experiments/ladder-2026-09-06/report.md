# Ladder pilot: code reduction and cheap-model quality are separate outcomes

The preregistered cheap-model replacement gate was **not met**. GPT-5.4 mini with
the ladder produced 1/3 builds passing the original checks, versus
3/3 for GPT-5.5 with kamae alone. Relative to that stronger-model
control, its median production bytes changed by **-34.6%**,
total generation tokens by **+35.8%**, and standard
API-equivalent cost by **-79.5%**.
Reduced source and lower unit prices do not establish comparable system quality.

This is one greenfield expense-workflow PRD, three repetitions per cell, and
medium reasoning effort. Both arms receive full kamae v1.4.0; only the treatment
also receives the [experimental ladder](../../guidance/ladder.md). It is inspired
by [ponytail's decision order](https://github.com/DietrichGebert/ponytail#how-it-works),
not a reproduction of its full plugin or published benchmark. See the
[protocol](protocol.md), [analysis notes](analysis-notes.md), and
[exploratory source review](review-notes.md).

For a review of the whole generated projects, browse the
[expanded implementations](implementations/README.md) and
[architecture comparison](architecture-review.md). Each project index includes
the original directory tree, all source/test files, design, and dependencies.
The architecture comparison distinguishes reduced repetition from concentrated
responsibilities; maintainability was not measured by this pilot.

## Preregistered outcomes

Medians include both design and implementation, including in-session repairs.
A passing build requires frozen-input integrity, typecheck, generated tests, and
all 19 held-out product checks. Every planned build remains in the denominator.
All 12/12 builds have both phase usage records.

| Model / guidance | Passing builds | Original checks | Total tokens | Output tokens | Production bytes | Production lines | API-equivalent USD bounds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-5.4-mini/kamae | 0/3 | 54/57 | 1,114,276 | 38,530 | 24,747 | 883 | $0.294 |
| gpt-5.4-mini/kamae-ladder | 1/3 | 55/57 | 1,177,264 | 34,986 | 20,849 | 761 | $0.295 |
| gpt-5.5/kamae | 3/3 | 57/57 | 866,660 | 22,766 | 31,898 | 1,050 | $1.438–$2.549 |
| gpt-5.5/kamae-ladder | 3/3 | 57/57 | 678,487 | 20,830 | 20,473 | 623 | $1.409–$2.505 |

Within mini, adding the ladder changes median tokens by
**+5.7%** and source bytes by
**-15.8%**. Within GPT-5.5, the corresponding changes
are **-21.7%** and
**-35.8%**. These within-model comparisons
separate the instruction effect from simply choosing a cheaper model.

| Preregistered descriptive gate | Result |
| --- | --- |
| mini+ladder: all three builds pass, with no fewer passes than either control | not met |
| mini+ladder: at least 10% lower median tokens, bytes, and standard cost than 5.5+kamae | not met |
| Within mini: at least 10% lower tokens and bytes without fewer passing builds | not met |

The overall gate also requires no observed quality regression. The exploratory
boundary results below must therefore be considered even where the original
19-check suite passes. These pilot thresholds are not a statistical proof of
equivalence or non-inferiority.

## Every paired observation

Changes are ladder / control minus one. Pair numbers link independent generations
of the same PRD, not identical random seeds. Order is K,L / L,K / K,L per model.

| Model / repetition | Original build pass: control → ladder | Total tokens | Production bytes | Standard-rate cost |
| --- | --- | ---: | ---: | ---: |
| gpt-5.4-mini / 1 | False → True | +0.9% | -29.8% | -3.6% |
| gpt-5.4-mini / 2 | False → False | +19.6% | -19.1% | +8.6% |
| gpt-5.4-mini / 3 | False → False | +5.2% | -10.3% | -0.9% |
| gpt-5.5 / 1 | True → True | -6.6% | -21.8% | -3.5% |
| gpt-5.5 / 2 | True → True | -21.7% | -35.8% | -2.0% |
| gpt-5.5 / 3 | True → True | -35.4% | -49.7% | -21.3% |

| Model / run | Build | Original checks | Total tokens | Production bytes | Production lines | Standard-rate USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| gpt-5.4-mini / 01-kamae | fail | 18/19 | 1,167,114 | 31,543 | 1,068 | $0.306 |
| gpt-5.4-mini / 01-kamae-ladder | pass | 19/19 | 1,177,264 | 22,155 | 761 | $0.295 |
| gpt-5.4-mini / 02-kamae-ladder | fail | 18/19 | 1,332,968 | 20,025 | 700 | $0.318 |
| gpt-5.4-mini / 02-kamae | fail | 18/19 | 1,114,276 | 24,747 | 873 | $0.292 |
| gpt-5.4-mini / 03-kamae | fail | 18/19 | 1,107,489 | 23,255 | 883 | $0.294 |
| gpt-5.4-mini / 03-kamae-ladder | fail | 18/19 | 1,165,540 | 20,849 | 826 | $0.291 |
| gpt-5.5 / 01-kamae | pass | 19/19 | 967,192 | 32,165 | 1,054 | $1.602 |
| gpt-5.5 / 01-kamae-ladder | pass | 19/19 | 903,221 | 25,138 | 913 | $1.546 |
| gpt-5.5 / 02-kamae-ladder | pass | 19/19 | 678,487 | 20,473 | 623 | $1.409 |
| gpt-5.5 / 02-kamae | pass | 19/19 | 866,660 | 31,898 | 963 | $1.438 |
| gpt-5.5 / 03-kamae | pass | 19/19 | 735,372 | 30,856 | 1,050 | $1.380 |
| gpt-5.5 / 03-kamae-ladder | pass | 19/19 | 475,414 | 15,507 | 527 | $1.086 |

## Exploratory boundary probes

These five checks were written after observing early source defects and were
applied unchanged to all twelve outputs in fresh projects. They were never sent
to the generators. They do not replace or retroactively expand the preregistered
19 checks: three malformed dot-atom email forms, one valid plus-address control,
and an unconfirmed gateway outcome carrying a receipt. The email cases follow
[RFC 5322's dot-atom syntax](https://www.rfc-editor.org/rfc/rfc5322.html#section-3.2.3).

| Model / guidance | All five pass | Probe checks | Measured builds |
| --- | ---: | ---: | ---: |
| gpt-5.4-mini/kamae | 0/3 | 4/15 | 3/3 |
| gpt-5.4-mini/kamae-ladder | 0/3 | 3/15 | 3/3 |
| gpt-5.5/kamae | 3/3 | 15/15 | 3/3 |
| gpt-5.5/kamae-ladder | 2/3 | 12/15 | 3/3 |

All six mini outputs accepted the three malformed emails; five also accepted
the unconfirmed payment. GPT-5.5 without the ladder passed all probes, while
its third ladder run failed the three malformed-email checks. Thus the original
19-check pass rate alone would have overstated quality preservation.

The original suite detected lost reviewer data in mini/01-kamae and
mini/02-kamae-ladder, plus an uncaught malformed-gateway exception in
mini/02-kamae, mini/03-kamae, and mini/03-kamae-ladder. Source review also found receipt-only payment confirmation and
permissive email parsing in early mini outputs. These are concrete behavioral
defects, not penalties for omitting a library, brand, layer, or Result wrapper.
See [probe-results.json](probe-results.json) and [review notes](review-notes.md)
for per-output evidence and limitations.

## Code size, tokens, and cost interpretation

Physical lines exclude a phantom trailing newline. UTF-8 bytes and TypeScript
AST statements excluding blocks provide additional measures of source size.
Variable declarations are recorded separately in [summary.json](summary.json).
Test files named `.test.ts` or `.spec.ts` are excluded from production metrics.
Third-party dependency source is not counted as project code.

| Model / guidance | Median AST statements | Median test bytes | Median generation seconds |
| --- | ---: | ---: | ---: |
| gpt-5.4-mini/kamae | 317 | 10,187 | 606 |
| gpt-5.4-mini/kamae-ladder | 303 | 10,718 | 561 |
| gpt-5.5/kamae | 333 | 10,398 | 481 |
| gpt-5.5/kamae-ladder | 242 | 12,065 | 433 |

Total tokens = input + output; cached input is already included in input.
Harness development, evaluator reasoning, and external dependency installation
are outside these per-build generation measurements.
Reported output already includes reasoning; it is not added again. Full usage,
tool-call counts, selected dependencies, hashes, and context audits are in the
summary. Dollar values use the official standard rates verified on 2026-09-06:
[mini: $0.75 / $0.075 / $4.50](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
and [5.5: $5 / $0.50 / $30](https://developers.openai.com/api/docs/models/gpt-5.5)
per million uncached-input / cached-input / output tokens.

These are **API-equivalent estimates, not Codex invoices**. Cumulative CLI usage
does not reveal each request's length. The table's lower bound uses standard
rates; its conservative upper bound applies GPT-5.5's long-context multipliers
to all tokens. Standard-rate ratios do not assert exact billing savings. Model
blocks overlap, so elapsed time is descriptive rather than an isolated latency
benchmark.

## Interpretation and next experiment

The useful question is which reductions preserve every required invariant.
Repeated mappings and speculative layers can shrink, while stored review history
and positive gateway confirmation must remain explicit. The samples show that
receiving a safety instruction is not sufficient evidence that a model obeyed it.

Do not promote this prompt to a default on the strength of source size alone.
A follow-up should fix required invariants and boundary contracts explicitly,
compare several independent PRDs and maintenance changes, and distinguish
ordered guidance from an equally short unordered minimalism instruction. Test
incremental context loading or cheap-model escalation as separate treatments;
neither was measured here. More repetitions and a declared non-inferiority margin
are needed for a general quality-equivalence claim. No-skill performance, system
load, concurrency, crash recovery, and long-term maintenance were not measured.

## Reproduction and artifacts

The runner uses fresh design and implementation sessions, macOS filesystem
isolation, frozen inputs, and per-phase initial-context preflight. A preflight
is not a capture of the actual remote request; see the protocol-v2 isolation
limits in [the benchmark README](../../README.md). The model IDs are aliases,
not a guarantee of immutable backend weights.

The [protocol](protocol.md) fixes the conditions; executable reproduction commands
are in [the benchmark README](../../README.md) and [analysis notes](analysis-notes.md).
The [artifact bundle](artifacts.tar.gz) includes generated source/tests, locks,
designs, grader outputs, frozen inputs, and sanitized manifests for all runs.
Temporary paths in docs/logs are normalized; source hashes are checked and source
bytes are unchanged. Authentication material, headers, initial-context bodies,
and raw generation transcripts are excluded; original transcripts remain in
the local ignored benchmark result directories.

Artifact SHA-256: `12cae61c9ff510f9e01f1755936bdb9a6157dc080645f95d44de1d129a8f74d3`.

Harness verification: TypeScript checking and all 18 harness tests pass.
The archive reproduces summary.json exactly, with all 12 source sets unchanged
and all 24 initial-context audits passing. The 12 real builds completed, but five
failed the original product suite; those failures are retained above.
