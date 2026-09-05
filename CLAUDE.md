# CLAUDE.md

Guidance for Claude Code instances working in this repository.

## Repository overview

`kamae-ts` is a plugin repository of coding-agent skills (`SKILL.md`-based) for functional domain modeling in server-side TypeScript. Two skills today: `kamae` (code generation) and `kamae-review` (adversarial review). Skills are installed via `gh skill install iwasa-kosui/kamae-ts <skill>` or the `skills` CLI. There is no application code; the repository primarily contains Markdown skill files, supporting documentation, build scripts, metadata, and CI workflows.

## PRD benchmark

`benchmarks/` compares the same PRD with and without `kamae`, using separate design
and implementation phases through `codex exec`. See `benchmarks/README.md` for the
protocol, model requirements, isolation limits, artifacts, and review rubric.
Run `bun run benchmark:typecheck` and `bun run benchmark:test` for harness changes;
run a real pair after changing prompts, cases, acceptance logic, or skill loading.
CI validates the harness and dry-run inputs without model calls. The files under
`evals/` are legacy task data, not an active evaluation runner.

## Worktree conventions

This repo uses `git worktree` under `.wt/<branch-name>/`. Session-start hooks create the worktree automatically; `git wt -d <branch>` removes it after merge. PRs are drafted, then promoted to ready after self-review.

## Language

Conversation is in 日本語 with the human; PR titles, PR bodies, commit messages, ADRs, and code comments are in English (kamae-ts is a public repo with non-Japanese contributors).
