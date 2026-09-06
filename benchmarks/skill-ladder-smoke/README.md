# Progressive checklist development smoke — 2026-09-06

The skills now select the first sufficient design step and deepen only unresolved
checks. This adapts the stopping criterion in
[Ponytail's ladder](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md)
to Kamae's domain, boundary, and error-handling requirements.

These are two small development cases, not a general quality benchmark. They informed
the edits, so the final results are not held-out evidence. Terra retained correctness
on these cases with less reported usage. Haiku used less context and avoided a false
positive, but still missed requirements. **This does not establish reliable Haiku
quality or justify removing verification.**

## Inputs and procedure

Baseline: `a65a117` (v1.4.0). Each invocation received a fresh workspace with the same
input, `package.json` (`zod: 4.1.5`, `neverthrow: 8.2.0`), and either baseline or
candidate `skills/` and `rules/`. Only supplied defaults applied. No prior model
conversation was carried over. No generated code was repaired before grading.

- [Generation input](generate.ts.txt), [exact prompt](generate.prompt.txt): complete
  a schema-backed module, preserving its exports and validation behavior.
- [Review input](review.ts.txt), [exact prompt](review.prompt.txt): three error defects
  plus valid state-decision, private-sentinel, and exhaustive-switch controls.

Haiku used `claude-haiku-4-5-20251001` through `claude -p --model haiku --safe-mode
--tools Read,Glob,Grep --permission-mode dontAsk --no-session-persistence
--output-format stream-json --verbose --setting-sources '' --strict-mcp-config` with
an empty MCP configuration. Terra used `gpt-5.6-terra`, low reasoning effort, and the
repository's `codexArgs` / OS isolation helpers. Each call had a 240-second deadline.

The current Codex CLI's loopback request used developer messages and `additional_tools`,
which the repository's older context auditor did not recognize. A temporary smoke
adapter checked the inspected message structure and absence of personal user context.
The actual remote request was not captured. Built-in CLI/tool descriptions varied
between invocations, so Terra's numbers are descriptive rather than a strict causal
comparison. One earlier Terra generation is retained separately in measurements;
subsequent preflight failures made no model calls. The production harness was not changed.

Generation ran three Bun checks: trimming/defaults and the safe-parse API; rejection
of malformed inputs; fresh, correct task records without input mutation. TypeScript
checked the readonly/literal public contract and schema-derived boundary types.
The last check adds an enum variant to the emitted schema declaration and checks
that the boundary type follows without editing its declaration.

An initial version of that last check also required a separate `Task` representation
to evolve, incorrectly failing Haiku candidate v3. The corrected check isolates the
boundary declaration and was applied to every completed generation. Original local
grader logs were retained. Review responses were inspected manually for defect
coverage, false positives on controls, and invalid repair suggestions.

## Baseline and final candidate (v5)

Input counts include cached input: Haiku's terminal `usage.input_tokens +
cache_creation_input_tokens + cache_read_input_tokens`; Terra's terminal
`usage.input_tokens` already includes cached input. Output includes reported reasoning
tokens. These are accumulated session tokens, not unique skill size or monetary cost.

| Model / case | Input, before → final | Output, before → final | Tool calls, before → final | Quality, before → final |
| --- | ---: | ---: | ---: | --- |
| Haiku / generation | 61,351 → 15,067 | 4,128 → 2,539 | 9 → 2 | 2/5 → 4/5 checks; schema inference still missing |
| Haiku / review | 45,126 → 24,383 | 3,387 → 1,744 | 7 → 3 | 3/3 → 2/3 defects; false positives 1 → 0 |
| Terra / generation | 43,791 → 39,591 | 942 → 702 | 3 → 3 | 5/5 → 5/5 checks |
| Terra / review | 74,218 → 44,350 | 1,560 → 1,211 | 5 → 3 | 3/3 → 3/3 defects; no false positives |

Across the two final cases, input plus output was 113,992 → 43,733 for Haiku
(−61.6%) and 120,511 → 85,854 for Terra (−28.8%). These final-pair totals exclude
development iterations; [measurements.json](measurements.json) retains their usage.
Prompt cache state and repeated exposure differed, and there is only one final
sample per case/model. Do not generalize these percentages to other tasks.

The [baseline and final responses](outputs/) preserve the evidence. Haiku's final
generation kept the handwritten type while incorrectly claiming it was derived.
Its review missed `fromSafePromise` misuse and overstated the severity of the thrown
business error. Terra's final responses passed the semantic checks; citation format
was not a scored criterion. PII, other validation/Result libraries, and larger
workflows were not exercised by these two model cases.

## Development iterations and decisions

| Candidate | Observed Haiku result | Response in the skill |
| --- | --- | --- |
| v1 | Runtime generation improved; duplicate type remained; catch-all defect missed | Split compound failure questions; show schema inference |
| v2 | Duplicate type and catch-all miss persisted; invalid alternative fix | Add a name-independent catch/err example and completion check |
| v3 | 5/5 generation checks; 3/3 defects, no control false positive | Independent review required raw-input versus parsed-output inference distinction |
| v4 | Duplicate type returned; 3/3 defects but an invalid catch-all repair alternative | Move schema reuse to the first rung; check suggested repairs against the same rules |
| v5 | 4/5 generation; 2/3 defects, no control false positive | Retain the simple guidance and document the reliability limit; no further tuning to these cases |

All these runs are development evidence, including the unsuccessful ones. Passing
v3 did not establish stable Haiku behavior: later runs contradicted it. The retained
instructions preserve the actual domain rules; their presence alone does not prove
that a model follows them. Follow-up evaluation should use new cases and repeated
runs, especially schema evolution and rejecting I/O, before claiming lower-model parity.

## Repository validation

Both skill validators, entrypoint link checks, `git diff --check`,
`bun run benchmark:typecheck`, all 14 harness tests, and a one-pair dry run passed.
The legacy YAML tasks have no active runner on this baseline; these real-model
smokes cover the changed skill procedure without reinstating that removed runner.
