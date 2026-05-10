# CLAUDE.md

Guidance for Claude Code instances working in this repository.

## Repository overview

`kamae-ts` is a plugin repository of coding-agent skills (`SKILL.md`-based) for functional domain modeling in server-side TypeScript. Two skills today: `kamae` (code generation) and `kamae-review` (adversarial review). Skills are installed via `gh skill install iwasa-kosui/kamae-ts <skill>` or the `skills` CLI. There is no application code — only Markdown skill files, YAML eval suites, and CI workflows.

## Skill quality evaluation with waza

Both skills have evaluation suites under `evals/<skill>/` that drive [`microsoft/waza`](https://github.com/microsoft/waza). Decision background is in [`docs/adr/0001-introduce-waza-for-skill-evals.md`](./docs/adr/0001-introduce-waza-for-skill-evals.md).

### Local runs (real-model, copilot-sdk)

The committed `config.executor` in each `evals/<skill>/eval.yaml` is `copilot-sdk`. A maintainer with an authenticated `copilot login` session can run a suite directly:

```bash
waza run evals/kamae/eval.yaml --verbose --output /tmp/results-kamae.json
waza run evals/kamae-review/eval.yaml --verbose --output /tmp/results-kamae-review.json
```

Preconditions:

- `waza` v0.31.0+ on PATH. Install from a GitHub Releases binary — `go install github.com/microsoft/waza/...` is broken upstream (the published `go.mod` declares `github.com/spboyer/waza`).
- `copilot login` already authenticated. The `copilot-sdk` executor refuses to run otherwise; passing `GITHUB_TOKEN` does not satisfy it.
- A live GitHub Copilot subscription. Each task burns Copilot premium requests (kamae: ~15 req/task, kamae-review: ~3 req/task with prompt caching).

Run real-model evaluations before tagging a release, after editing any `skills/<skill>/**` file, and after touching the eval graders themselves. Treat aggregate score < 0.7 on either suite as a regression to investigate.

### CI runs (mock override)

`.github/workflows/eval.yml` runs on `pull_request` and `workflow_dispatch`. Before invoking `waza run`, the workflow rewrites `executor: copilot-sdk` -> `executor: mock` with `sed -i`, because GitHub-hosted runners cannot satisfy the `copilot login` requirement non-interactively. Mock CI catches:

- YAML schema breaks (tasks, graders, fixture references)
- Missing fixture files
- Grader misconfiguration (regex syntax, unsupported keys)
- Trigger-metadata regressions in `SKILL.md` frontmatter

Mock CI does **not** catch semantic regressions in skill prose — that's the maintainer's local-run responsibility above.

### When designing new graders

- Mock returns canned text that echoes the prompt, so `text` graders matching keywords from the prompt itself trivially pass under mock. This is acceptable for structural validation; real-model graders are what gate semantic quality.
- `behavior` graders with `required_tools` always fail under mock (mock never invokes tools). Use `max_tool_calls` and other tool-count metrics that mock can satisfy. Tool-presence checks belong in real-model-only graders or get scoped per-task on the local-run side.
- A "no findings" task (e.g. clean-code negative control) cannot use a global `regex_match` grader that requires severity tags — there's nothing to tag. Either make the grader task-scoped or invert it to `regex_not_match` for High/Medium.

### Adding a new task

1. Drop the fixture under `evals/<skill>/fixtures/<path>` (paths are relative to the suite's `fixtures/` root — no `source:` key).
2. Create `evals/<skill>/tasks/<task-id>.yaml` with `id`, `name`, `inputs.prompt`, `inputs.files: [{path: ...}]`, and `expected.outcomes: [{type: task_completed}]`.
3. Run the suite locally with `executor: copilot-sdk` to verify it passes against the real model. Adjust grader thresholds based on observed scores rather than guessing.
4. Confirm CI passes under mock — if a grader fails under mock that the real model handles fine, the grader is too strict for structural validation; relax it or scope it per-task.

## Worktree conventions

This repo uses `git worktree` under `.wt/<branch-name>/`. Session-start hooks create the worktree automatically; `git wt -d <branch>` removes it after merge. PRs are drafted, then promoted to ready after self-review.

## Language

Conversation is in 日本語 with the human; PR titles, PR bodies, commit messages, ADRs, and code comments are in English (kamae-ts is a public repo with non-Japanese contributors).
