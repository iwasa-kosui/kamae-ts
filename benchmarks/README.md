# PRD design and implementation benchmark

For release comparisons using actual modifications of existing applications and
blinded corrective agent assessment, see the [implemented-change benchmark](change/README.md).

Compare the same model, reasoning effort, product requirements, and starting
toolchain with and without the in-tree `kamae` skill. Each condition proposes a
design and implements it in a fresh session. `kamae-review` is not an automatic judge.

## Protocol v2: remove design priming

The original protocol preinstalled Zod and neverthrow, supplied a TypeScript
contract with readonly function properties, requested state/boundary/error design
topics, and graded internal snapshot immutability and exception propagation.
These choices overlapped with kamae. Those results cannot isolate its contribution.

Version 2 starts with **no runtime dependencies and no TypeScript source**. The
common prompt asks for a design and rationale without listing architectural
techniques. The [PRD](cases/expense-approval/prd.md) states business needs;
[API.md](cases/expense-approval/starter/API.md) defines the host integration format.
Models choose storage format, organization, types, internal errors, and libraries.
An HTTP-style 500 at the adapter does not prescribe internal error representation.

The expense workflow and email privacy requirements are relevant to this skill.
Selecting this case does not establish performance across arbitrary products.
Shared requirements necessarily constrain behavior.

## Run

Requires Bun 1.3.14+, Git, and an authenticated Codex CLI supporting
`codex exec --ignore-user-config --ephemeral --json` and custom Responses providers.
The selected model must be supported by the account and CLI. Runs use the existing
login and consume model usage. Harness tests require loopback HTTP and dependency
installation; CI does not call a model.

```sh
bun install --frozen-lockfile
bun run benchmark:typecheck
bun run benchmark:test
bun run benchmark --dry-run --runs 1

# macOS: additionally block personal instructions and benchmark-source reads.
bun run benchmark --model gpt-5.5 --runs 2 --isolation macos

# An already clean, disposable environment: audit every phase.
bun run benchmark --model gpt-5.5 --runs 2 --isolation audit
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--model` | Required for real runs | Exact model ID shared by both conditions |
| `--case` | `expense-approval` | Case under benchmarks/cases/ |
| `--runs` | `3` | Number of pairs, 1–20 |
| `--reasoning-effort` | `medium` | low, medium, high, or xhigh |
| `--timeout-seconds` | `900` | Deadline per generation phase |
| `--output` | Timestamped benchmarks/results/ path | Existing directories refused |
| `--codex-bin` | `codex` | Executable path, without shell expansion |
| `--isolation` | `audit` | audit or macos; both require context preflight |
| `--dry-run` | Off | Prepare without generation or grading |

## Generation and grading

1. Freeze the case, skill, rules, and hashes. Create a temporary workspace outside
   the repository. Supply only PRD, API documentation, package manifest/lockfile,
   and the TypeScript/Bun development toolchain. Treatment also receives kamae
   and its default rules. The common prompt authorizes unattended design/library
   choices; only treatment is instructed to read and apply the skill.
2. Audit initial context, then generate DESIGN.md. The model may change only the
   dependencies field of package.json, choosing exact registry versions. Reject
   other supplied-input changes and implementation files.
3. Install selected packages with lifecycle scripts disabled. Freeze package and
   lockfile along with the design. Start a fresh session, audit context, implement
   code/tests under src/, and require IMPLEMENTATION.md explaining deviations.
4. Verify frozen files. Copy generated source and selected dependencies into a
   clean grading project with trusted scripts and TypeScript configuration. Run
   typechecking and generated tests, then introduce held-out acceptance tests.
   Their output is never fed back to the model for repairs.
5. Record every planned run, including failures. The 19 acceptance checks examine
   product/API behavior with a JSON-round-tripping repository and fake gateway.
   They do not inspect classes/functions, brands, Result types, schema libraries,
   pure functions, or internal snapshot immutability.

Odd pairs run baseline first; even pairs run kamae first. Each phase has the same
deadline and settings. No post-hoc retries or model substitution. Extra skill
context and chosen dependencies are part of the treatment and its outcome.
This is not a comparison at a fixed token budget.

## Context evidence and limits

`--ignore-user-config` skips user configuration; `project_doc_max_bytes=0` does
**not** suppress global AGENTS.md in the CLI version audited here. The v1 claim
that these flags disabled all instructions was incorrect.

Every v2 phase first invokes the same exec command against an unauthenticated
loopback receiver. It captures the initial request body and returns HTTP 400
without forwarding anything or calling a model. Headers and credentials are not
saved. Only the exact task prompt, environment message, and CLI permissions
message are accepted; extra context fails before generation. CLI base instruction
and tool-definition hashes must remain constant across phases.

This preflight uses a different provider transport. It is **not a saved copy of
the subsequent remote request**; provider-specific model metadata can differ.
The installed CLI defaults are still instructions. Saved inputs show what was
inspected, rather than claiming that flags alone prove isolation.

The runner disables discovered global skills, plugins, hooks, apps, memories,
web/skill search, and subagents. Treatment discovery is disabled too: the explicit
prompt supplies its file path, so no extra catalog is injected. Only supplied
default rules apply; personal preferences are not inputs.

On macOS, the recorded sandbox-exec profile denies personal agent/Claude
instructions, config, rules, skills, plugins, memories, ancestor guidance, and
benchmark source/result reads. Writes are limited to that run's workspace,
artifacts, Codex internal state, and /dev/null; instruction paths remain denied.
Authentication is untouched; no personal files or HOME/CODEX_HOME settings are
changed by the runner. Each run first probes allowed workspace reads/writes and
denied personal-instruction reads and outside writes, without calling a model.

Nested macOS sandboxes prevent tool execution in the audited CLI. Therefore macos
mode supplies the external OS sandbox and passes `--sandbox danger-full-access`
to Codex to avoid creating a second sandbox. This flag is used only behind the
mandatory outer profile and successful probe. Audit mode retains Codex's own
workspace-write sandbox. The external profile is not a container, permits network
access for the CLI, and does not isolate every OS resource. Audit mode adds no
filesystem restriction and is intended for an already clean environment.

Generated code runs locally during grading; no real payment system is connected.
Selected dependencies have exact registry versions and installation scripts
disabled, but ordinary package runtime code still executes.

## Results and interpretation

manifest.json records protocol version, settings, versions, revision, run order,
and case/skill/rules/runner hashes. Runs include initial-context captures/audits,
sandbox profile when used, prompts/commands, JSONL logs, frozen DESIGN.md,
workspace, implementation notes, and grader output. Chosen dependencies are in
results.json and package.json. Outputs include local paths and are ignored by Git;
inspect before sharing.

report.md separates generation completion from correctness. Failed runs stay in
the denominator with zero credit. Missing/truncated reports, timeouts, and skipped
tests cannot silently pass. Missing token usage is not zero. Cached input and
wall time are not monetary cost. Dependency installation and context preflight
are outside reported generation time.

Use review.md for an evidence-based human comparison of design and code. Its seven
dimensions cover requirements, correctness, reliability, privacy, maintainability,
design fidelity, and tests. Unreviewed cells stay blank. Describe architecture
separately; do not award points for patterns, libraries, keywords, or file counts.
Small samples cannot establish statistical superiority. Compare v2 conditions
with each other, not against v1 scores as if the PRD/grader were unchanged.

If the grader needs correction, record the reason and preserve the original run.
Regrade every completed generation with one common suite, without model calls or
code repairs. The suite must retain the manifest's expected top-level test count:

```sh
bun run benchmark:regrade benchmarks/results/RUN \
  benchmarks/cases/expense-approval/acceptance benchmarks/results/REGRADED
```

This writes a separate report with grader hashes and checks that original
workspaces/results remain unchanged. Failed generations remain in the denominator.
It refuses in-progress runs and existing output directories. Report original and
corrected scores and explain any grader correction; do not silently replace scores.

## Extend a case

Add case.json (id/name/expectedTests), prd.md,
starter/{API.md,package.json,bun.lock,tsconfig.json}, and acceptance tests importing
../src/index under benchmarks/cases/<id>/. Do not supply domain types, reference
implementations, architecture instructions, or runtime packages in the starter.
Keep the development toolchain pinned. Document host behavior without prescribing
internal design. Keep acceptance tests held out; add positive and deliberately
broken controls and increment expectedTests for new top-level tests.

Run a real comparison after changing common inputs, prompts, skill loading, or
acceptance logic. CI checks the harness and dry runs without model calls.

CLI references: [non-interactive execution](https://developers.openai.com/codex/noninteractive),
[skill discovery](https://developers.openai.com/codex/skills), and
[configuration](https://developers.openai.com/codex/config-reference).
