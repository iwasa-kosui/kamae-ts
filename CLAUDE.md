# CLAUDE.md

Guidance for Claude Code instances working in this repository.

## Repository overview

`kamae-ts` is a plugin repository of coding-agent skills (`SKILL.md`-based) for functional domain modeling in server-side TypeScript. Two skills today: `kamae` (code generation) and `kamae-review` (adversarial review). Skills are installed via `gh skill install iwasa-kosui/kamae-ts <skill>` or the `skills` CLI. There is no application code — only Markdown skill files, YAML eval suites, and CI workflows.

## Skill quality evaluation

Both skills have evaluation suites under `evals/<skill>/`, driven by an in-repo TypeScript runner at `evals/runner/run.ts`. The runner spawns `claude -p` for each task, parses its `--output-format stream-json`, and applies the suite's `text` / `behavior` graders. Decision background: [`docs/adr/0002-replace-waza-with-claude-code-runner.md`](./docs/adr/0002-replace-waza-with-claude-code-runner.md) (supersedes [`docs/adr/0001-introduce-waza-for-skill-evals.md`](./docs/adr/0001-introduce-waza-for-skill-evals.md)).

### Local runs (real-model, Claude Code)

```bash
bun install   # first time only
bun run evals/runner/run.ts evals/kamae/eval.yaml --output /tmp/results-kamae.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --output /tmp/results-kamae-review.json
```

Preconditions:

- `bun` and `claude` on PATH. The runner shells out to `claude -p` and consumes the maintainer's authenticated Claude Code session — no separate API key wiring needed.
- The runner passes `--plugin-dir <repo-root>` so the in-tree `skills/kamae/` and `skills/kamae-review/` are loaded as `kamae-ts:kamae` and `kamae-ts:kamae-review`. Edits to `SKILL.md` files take effect on the next run; no reinstall needed.

Run real-model evaluations before tagging a release, after editing any `skills/<skill>/**` file, and after touching the eval graders themselves. Treat aggregate score < 0.7 on either suite as a regression to investigate.

Pass `--model claude-sonnet-4-6` (or another alias) to override the model the runner spawns. Pass `--repo-root <path>` if invoking from outside the worktree.

### CI runs (dry-run only)

`.github/workflows/eval.yml` runs on `pull_request` and `workflow_dispatch`, invoking the runner with `--dry-run`. No model is called from CI. The dry-run validates:

- Suite YAML parses with the expected schema (`name`, `skill`, `graders`, `tasks`).
- Each grader's regex compiles (PCRE-style inline flags like `(?m)` and `(?i)` are supported via `evals/runner/regex.ts`).
- Every `inputs.files[].path` resolves under `evals/<skill>/fixtures/`.
- Each suite's `skill:` resolves to a `skills/<name>/SKILL.md` whose frontmatter `name` matches.

CI does **not** catch semantic regressions in skill prose — that remains the maintainer's local-run responsibility above.

### When designing new graders

- `text.regex_match[]` / `regex_not_match[]`: every pattern must match (or not match) the assistant's final result text. Inline flags `(?i)`, `(?m)`, `(?s)`, `(?u)` are supported.
- `behavior.max_tool_calls`: counts every `tool_use` block across the run. Practical thresholds for these suites are 15 (kamae) and 20 (kamae-review).
- `behavior.required_tools`: only meaningful in real-model runs; the dry-run does not invoke `claude`. Scope tool-presence checks per-task rather than at suite level if a "no-tool" task exists.
- A "no findings" task (e.g. clean-code negative control) cannot use a global `regex_match` grader that requires severity tags — there's nothing to tag. Either make the grader task-scoped or invert it to `regex_not_match` for High/Medium.

### Adding a new task

1. Drop the fixture under `evals/<skill>/fixtures/<path>` (paths in `inputs.files[].path` are relative to the suite's `fixtures/` root — no `source:` key).
2. Create `evals/<skill>/tasks/<task-id>.yaml` with `id`, `name`, `inputs.prompt`, `inputs.files: [{path: ...}]`, and `expected.outcomes: [{type: task_completed}]`.
3. Run the runner locally to verify it passes against the real model. Adjust grader thresholds based on observed scores rather than guessing.
4. Confirm CI's `--dry-run` passes — if dry-run flags a grader pattern that the real model handles fine, fix the regex (it's likely an authoring mistake, not a runner limitation).

## Worktree conventions

This repo uses `git worktree` under `.wt/<branch-name>/`. Session-start hooks create the worktree automatically; `git wt -d <branch>` removes it after merge. PRs are drafted, then promoted to ready after self-review.

## Language

Conversation is in 日本語 with the human; PR titles, PR bodies, commit messages, ADRs, and code comments are in English (kamae-ts is a public repo with non-Japanese contributors).
