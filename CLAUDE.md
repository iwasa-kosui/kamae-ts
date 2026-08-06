# CLAUDE.md

Guidance for Claude Code instances working in this repository.

## Repository overview

`kamae-ts` is a plugin repository of coding-agent skills (`SKILL.md`-based) for functional domain modeling in server-side TypeScript. Two skills today: `kamae` (code generation) and `kamae-review` (adversarial review). Skills are installed via `gh skill install iwasa-kosui/kamae-ts <skill>` or the `skills` CLI. There is no application code; the repository primarily contains Markdown skill files, supporting documentation, build scripts, metadata, and CI workflows.

## Worktree conventions

This repo uses `git worktree` under `.wt/<branch-name>/`. Session-start hooks create the worktree automatically; `git wt -d <branch>` removes it after merge. PRs are drafted, then promoted to ready after self-review.

## Language

Conversation is in 日本語 with the human; PR titles, PR bodies, commit messages, ADRs, and code comments are in English (kamae-ts is a public repo with non-Japanese contributors).
