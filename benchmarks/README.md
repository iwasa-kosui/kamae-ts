# PRD design and implementation benchmark

Compare **the same model, reasoning effort, PRD, and starter project with and
without the in-tree `kamae` skill**. Each condition proposes a design first, then
implements it in a second fresh session. This measures the generation skill;
`kamae-review` is neither the treatment nor an automatic judge.

## Run

Requires Bun 1.3.14+, Git, and an authenticated Codex CLI supporting `codex exec`,
`--ignore-user-config`, `--ephemeral`, `--json`, and `skills.config` overrides.
The selected model must be supported by your CLI/account. No API key is required
when using your existing Codex login. Real runs consume the account's model usage.

```sh
bun install --frozen-lockfile

# Validate inputs and save both prompts/workspaces without calling a model.
bun run benchmark --dry-run --runs 1

# One pair for a smoke test (4 model sessions: design + implementation per condition).
bun run benchmark --model gpt-5.5 --runs 1

# Repeat the same comparison three times; choose your exact available model.
bun run benchmark --model gpt-5.5 --runs 3 --reasoning-effort medium

bun run benchmark:test
bun run benchmark:typecheck
```

Options:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--model` | Required for real runs | Exact model ID, shared by both conditions |
| `--case` | `expense-approval` | PRD under `benchmarks/cases/` |
| `--runs` | `3` | Number of pairs, 1–20 |
| `--reasoning-effort` | `medium` | low, medium, high, or xhigh; must be supported by the model |
| `--timeout-seconds` | `900` | Deadline for each design/implementation phase |
| `--output` | `benchmarks/results/<timestamp>` | New directory; existing directories are refused |
| `--codex-bin` | `codex` | CLI executable path; no shell command expansion |
| `--dry-run` | Off | Prepare artifacts without model generation or grading |

Exit code 1 means a setup/generation/integrity failure or a failed typecheck,
self-test, or acceptance check. Per-condition failures do not prevent the other
condition from running. Partial model logs and results are retained.

## What is compared

The initial case, [expense approval](cases/expense-approval/prd.md), exercises
draft/submitted/approved/rejected/paid states, authorization, payment idempotency,
recoverable declines, unexpected faults, runtime validation, and email privacy.
The common adapter constrains observable behavior, leaving internal architecture
and library use free. Both conditions receive identical pinned dependencies.

1. Create a fresh temporary workspace outside this repository. Copy only the
   PRD and starter. `kamae` additionally receives a snapshot of `skills/kamae`
   and `rules`, with an explicit instruction to apply the skill.
2. Generate **DESIGN.md only**. Save its original bytes before implementation.
3. Start a fresh session with the same model/settings, workspace, and proposal.
   Implement code and tests under `src/`; record deviations in IMPLEMENTATION.md.
4. Check that the proposal, PRD, starter contract/config, and supplied skill files
   remain unchanged. Copy generated source into a clean grading project using
   trusted starter configuration and dependencies.
5. Run TypeScript, the generated tests, and 19 shared acceptance checks. Acceptance
   test source is supplied only after generation, and its output is never fed
   back for repairs. The model can repair its own tests during its initial session.

Odd repetitions run baseline first; even repetitions run kamae first. Each phase
gets the same wall-clock deadline; additional skill context is part of the treatment.
This is a context ablation, not a fixed-token comparison. There is no post-hoc
retry of failed model generations or automatic model substitution.

## Read the results

Open `report.md` in the output directory. It links each condition's frozen design,
source, implementation notes, and review sheet. `results.json` records generation
status separately from correctness, exact command outcomes, timing, and token
usage when the CLI reports it. Unavailable usage is null, not zero. Input token
counts may include cached tokens; this report does not estimate monetary cost.

`manifest.json` records the requested model/effort, CLI/Bun versions, Git revision,
run order, disabled skill paths, and SHA-256 hashes of the case and skill/rules.
The output includes their snapshots, exact phase prompts/argument arrays, final
messages, raw JSONL events, stderr, and JUnit acceptance reports. Results and local
machine paths are ignored by Git; inspect before sharing them publicly.

Generation failures and integrity violations stay in the aggregate acceptance
denominator with zero credit. A completed generation can still fail typechecking
or behavioral checks. Tests that fail to load, truncated reports, timeouts, and
missing test counts cannot produce a passing score. Skipped tests receive no credit.

Architecture is evaluated separately using each run's `review.md`. Score eight
dimensions from 0–2 with file/line evidence, comparing the design promise with the
implementation. Unreviewed dimensions stay blank. The report does not fabricate
a design score from prose keywords or reward class/function, Result, schema,
branding, or file-count choices by themselves. A PRD pass rate is not a general
measure of design quality, and one pair is not evidence of statistical superiority.

## Isolation and limits

The runner keeps the existing Codex login but ignores user config, suppresses
AGENTS.md loading, disables discovered skills in `~/.agents/skills`,
`$CODEX_HOME/skills` (default `~/.codex/skills`), `/etc/codex/skills`, and the
temporary directory's `.agents/skills`, and disables plugins, hooks, apps, memory,
web search, skill search, and subagents. It never rewrites user config or auth.
The generation prompt permits only supplied workspace material, overriding the
skill's usual instruction to look up user-global rules.

These controls reduce context contamination; they are **not a hermetic security
boundary**. Codex's workspace-write sandbox still permits filesystem reads, and
admin requirements or CLI changes may affect execution. Confirm the recorded
configuration and tool trace when making comparisons on a new machine/version.
Use a disposable machine/container for stronger isolation. Acceptance runs execute
generated code locally and use an in-memory fake gateway; they do not pay anyone.

CLI references: [non-interactive execution](https://developers.openai.com/codex/noninteractive),
[skill discovery](https://developers.openai.com/codex/skills), and
[configuration](https://developers.openai.com/codex/config-reference).

## Extend a case

Add `benchmarks/cases/<id>/case.json` (`id`, `name`, `expectedTests`), `prd.md`,
`starter/{package.json,bun.lock,tsconfig.json,src/contract.ts}`, and
`acceptance/*.test.ts`. Tests import the observable adapter from `../src/index`.
Keep business requirements independent of kamae-specific implementation choices.
Pin starter dependencies and commit the lockfile. Increase `expectedTests` when
adding a top-level test; nested loops intentionally remain one requirement check.

Add a positive control and a deliberately broken implementation to the grader's
tests so passing/failing is verified without a model. Run a real pair whenever
changing the PRD, prompts, isolation, or acceptance logic. CI validates the harness,
positive/negative grader controls, and dry-run artifacts without model calls.
