# Ladder pilot: preregistered protocol

Frozen before real generation on 2026-09-06. Base revision: a65a117 (kamae v1.4.0).

## Question and treatment

Can an ordered minimal-solution decision process added to kamae preserve observed
product quality while reducing code, generation tokens, and estimated cost? Can
the cheaper model with that guidance match the stronger model with kamae alone?

This tests the independently worded [ladder](../../guidance/ladder.md), inspired by
[ponytail's decision order](https://github.com/DietrichGebert/ponytail#how-it-works).
It does not install or benchmark the entire ponytail plugin, hooks, or persona.
No production skill files change. Full kamae remains supplied in both arms, so this
does not test replacing the full skill with progressively loaded short guidance.

## Fixed design

- Models: `gpt-5.4-mini` and `gpt-5.5`; reasoning effort `medium` throughout.
- Arms: `kamae` and `kamae-ladder`; three fresh repetitions per model/arm (12
  implementations, 24 generation phases). No seed control is available.
- Task: existing protocol-v2 expense-approval PRD, API, and 19 held-out checks.
- Same two-phase design/implementation workflow, starter, skill, toolchain,
  timeouts (900 seconds per phase), and macOS isolation/context preflight.
- Each model runs serially: K,L / L,K / K,L. The two model blocks may overlap;
  wall time is descriptive and may reflect resource contention.
- No failed-output repairs after a phase, no acceptance feedback to generators,
  no unplanned retries or model substitutions. Infrastructure failures retained
  and distinguished from product failures. Never drop a failed arm from a pair.
- Freeze hashes of case, skill, ladder, runner, prompts, and context evidence in
  each output directory. Preserve all generation logs and source artifacts.

## Outcomes and decision rule

Primary quality outcome: successful builds / all planned builds. A successful
build completes both phases, preserves frozen inputs, passes TypeScript and its
own tests, and passes all 19 held-out checks. Also report check counts, including
zero credit for incomplete generation. Test pass rate is not production safety.
Inspect generated source for concrete correctness, privacy, and maintainability
issues; this exploratory review is not blinded and is not a numeric causal score.

Resource outcomes: total input + output tokens (cached input is a subset of input,
not added again), output tokens, uncached and cached input separately, tool calls,
generation wall time, production TypeScript physical lines and UTF-8 bytes,
and TypeScript AST statement/declaration count to expose formatting compression.
Test code is reported separately, never mixed into production size.
Missing usage is unknown, never zero. Summaries use per-cell medians and paired
ratios within a model; report every individual observation as well.

API-equivalent cost in USD = ((input - cached) * input price + cached * cached
price + output * output price) / 1,000,000. This is an estimate, not Codex billing.
Prices per million tokens verified on official model pages on 2026-09-06:

| Model | Input | Cached input | Output | Source |
| --- | ---: | ---: | ---: | --- |
| gpt-5.4-mini | 0.75 | 0.075 | 4.50 | [OpenAI](https://developers.openai.com/api/docs/models/gpt-5.4-mini) |
| gpt-5.5 | 5.00 | 0.50 | 30.00 | [OpenAI](https://developers.openai.com/api/docs/models/gpt-5.5) |

These are standard short-context rates; if any single request exceeds the GPT-5.5
272K pricing threshold, mark the estimate uncertain rather than assuming the
cumulative input count across turns is one request. No actual invoice is available.

Call this pilot promising only if mini+ladder succeeds in all three builds, has
no observed quality regression against either mini+kamae or 5.5+kamae, and its
median tokens, production bytes, and cost are each at least 10% lower than
5.5+kamae. Claim a within-model ladder saving only if mini+ladder also reduces
median tokens and production bytes by at least 10% against mini+kamae without
fewer successful builds. Report other outcomes as mixed, negative, or inconclusive.

These are descriptive pilot gates, not statistical non-inferiority evidence.
One greenfield PRD and three repetitions cannot establish general superiority,
maintenance cost, brownfield reuse, or equivalence. A positive result warrants
multiple independent PRDs/change tasks and more repetitions before skill adoption.
