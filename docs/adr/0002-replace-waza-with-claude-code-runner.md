# ADR 0002: Replace waza with a Claude Code-driven eval runner

- Status: Accepted
- Date: 2026-05-10
- Deciders: @iwasa-kosui
- Supersedes: [ADR 0001](./0001-introduce-waza-for-skill-evals.md)

## Context

[ADR 0001](./0001-introduce-waza-for-skill-evals.md) adopted [`microsoft/waza`](https://github.com/microsoft/waza) with `executor: copilot-sdk` for local maintainer runs and `executor: mock` for CI. After running both suites locally a few times, two problems became hard to ignore:

1. **Every local run consumes GitHub Copilot premium requests.** Measured directly before this ADR: `kamae` burned 15 requests per run, `kamae-review` burned 13. With `trials_per_task: 1` and three tasks per suite, this is unavoidable cost — `copilot-sdk` is the only real-model executor waza supports.
2. **There is no path to a Claude-direct executor inside waza v0.31.0.** The JSON schema enum on `config.executor` is exactly `{copilot-sdk, mock}`. `internal/execution/engine.go` is hardcoded against `github.com/github/copilot-sdk/go`. There is no Anthropic / Claude Code integration in the execution layer and no upstream issue or branch suggesting one is coming.

The maintainer is already using Claude Code daily. Routing the eval through `claude -p` instead of through GitHub Copilot eliminates the Copilot request cost, removes the `copilot login` precondition, and makes the runner reproduce exactly the agent behavior real users experience when they install this plugin via `gh skill install`.

## Decision

Replace the waza binary with a small bespoke runner under `evals/runner/` that drives Claude Code in headless mode (`claude -p --output-format stream-json`), and keep the existing `evals/<skill>/{eval,tasks}.yaml` schema unchanged so prior fixtures and graders are reused as-is.

Concretely:

1. **Add `evals/runner/`** — TypeScript, run with `bun run evals/runner/run.ts <eval.yaml>`. Modules: `types.ts` (suite/task/result types), `yaml.ts` (suite/task loaders), `claude.ts` (subprocess + stream-json parser), `graders.ts` (text/behavior graders matching waza's semantics), `regex.ts` (PCRE-style inline-flag shim — JavaScript's `RegExp` rejects `(?m)` etc., so the runner extracts and reapplies them as native flags), `dryRun.ts` (structural validation), `run.ts` (CLI entry).
2. **`evals/<skill>/eval.yaml` is reused** — drop the `config.executor` and `config.model` keys (no longer needed), but `graders`, `metrics`, `tasks`, and the entire `tasks/*.yaml` tree stay byte-identical with the waza-era versions.
3. **Skill loading via `--plugin-dir <repo-root>`.** The repo is itself a Claude Code plugin (`.claude-plugin/plugin.json`), so passing the repo root to `claude -p` exposes `kamae-ts:kamae` and `kamae-ts:kamae-review` as skills the agent can `/skill-name` into. No symlinks under `~/.claude/skills/` and no interference with the maintainer's installed plugins.
4. **CI runs the structural `--dry-run`, not the real model.** The runner's `--dry-run` mode validates: every grader compiles, every fixture path resolves, every task YAML has the required keys, and each suite's `skill:` resolves to a `skills/<name>/SKILL.md` whose frontmatter `name` matches. This replaces what the waza+mock combination was catching. Real-model runs remain a maintainer-local pre-release step, same as ADR 0001.
5. **Delete `.waza.yaml`, drop the `microsoft/waza` install step in `.github/workflows/eval.yml`, and replace the `sed` executor-rewrite with a `bun install` + `bun run … --dry-run` pair.** Bun is already a native dependency in this repo's lockfile.

## Consequences

Positive:

- **No Copilot premium requests for evals.** Real-model runs go through the maintainer's Claude Code subscription instead. Dollar cost is metered through Anthropic's billing, where the maintainer already has visibility.
- **Eval target == real install target.** Users install this plugin into Claude Code; the eval now drives the same code path. `copilot-sdk`'s rendering of skills was a second translation layer that could have masked or introduced regressions.
- **No upstream dependency on a `v0.x` tool with a transferred-but-not-renamed Go module.** The pin-by-binary-URL workaround documented in ADR 0001 is gone.
- **CI is faster and lighter.** No 11 MB binary download, no `sudo mv`, no schema-rewrite step.

Negative / preconditions:

- **Maintenance of the runner is now on us.** ~500 lines of TypeScript that we own. The risk surface is the stream-json schema (Claude Code may rename fields between versions). The runner only depends on `type: assistant` (with `tool_use` content blocks) and `type: result` (with `result`, `is_error`, `total_cost_usd`) — both stable since 2.x. We accept the version-skew risk in exchange for the cost savings.
- **The shipped binary parity check is gone.** waza was at least battle-tested across other skill repos. Our runner is unique to `kamae-ts`. If a third-party wants to evaluate their fork, they reuse our runner or write their own — they can no longer drop in stock waza.
- **Real-model evaluations still don't run on PRs.** ADR 0001's premise (don't put cloud model auth on a stock GitHub-hosted runner) is unchanged. Anthropic API keys would have to live in Secrets, with the same operational concerns Copilot had. Maintainer-local pre-release runs continue to be the gate.

## Alternatives considered

- **Submit a `claude-code` executor PR upstream to `microsoft/waza`.** Rejected: solves the problem for everyone but blocks our migration on upstream review velocity, and we have no signal upstream wants this. Reconsider if waza picks up such a contribution from another contributor.
- **Keep waza, switch only CI's behavior, eat the Copilot cost locally.** Rejected by the explicit user goal: stop burning Copilot premium requests.
- **Build the runner against `claude-agent-sdk` instead of the CLI.** Considered but heavier — the SDK is another dependency edge, and we get no capability the CLI doesn't already expose for this scope (single-shot prompt, tool-use accounting, stream-json parsing). The CLI is also the surface real users see.

## Follow-ups

- Watch Claude Code's `--output-format stream-json` schema across releases. Add a startup assertion on `system.subtype="init"` if the field set changes.
- Consider a parallel-execution mode (`config.parallel: true`) once we have data on Anthropic per-second rate limits in the maintainer's tier. Today the runner is sequential.
- Re-add a real-model PR job once Anthropic's hosted-runner story matures, mirroring the ADR 0001 follow-up that targeted Copilot.
