# ADR 0001: Introduce microsoft/waza for skill quality evaluation

- Status: Proposed
- Date: 2026-05-10
- Deciders: @iwasa-kosui

## Context

`kamae-ts` ships two coding-agent skills, `kamae` and `kamae-review`, as a tree of `SKILL.md` files plus topic sub-files (`domain-modeling.md`, `state-modeling.md`, …), library guides (`result-libraries/*.md`, `validation-libraries/*.md`), and a checklist (`skills/kamae-review/checklist/*.md`).

The skills are large enough that small edits — a re-worded paragraph in `domain-modeling.md`, a moved citation in a checklist file, a renamed library guide — can change how an agent applies the skill in practice. Today the only quality signal is manual review on the PR. There is no objective benchmark answering "given a representative TypeScript task, does the agent still produce kamae-conforming output after this change?"

Without that signal:

- Regressions ship silently to users of `gh skill install iwasa-kosui/kamae-ts` until a downstream report.
- Reviewers cannot distinguish stylistic edits to skill prose from edits that materially change agent behaviour.
- There is no baseline against which to measure whether new sub-files (planned for further `kamae` topics) actually improve adherence.

## Decision

Adopt [`microsoft/waza`](https://github.com/microsoft/waza) as the skill evaluation framework for this repository.

Concretely:

1. Add a top-level `.waza.yaml` configured with `engine: copilot-sdk` and `model: claude-sonnet-4.6`.
2. Add `evals/kamae/` and `evals/kamae-review/` suites, each with a small set of positive and should-skip tasks (proof-of-life only — broader topic coverage is deferred).
3. Add `.github/workflows/eval.yml` that runs both suites on every pull request that touches `skills/**`, `evals/**`, `rules/**`, or `.waza.yaml`, plus on `workflow_dispatch`.
4. Use `text` and `behavior` graders only at the start. LLM-as-judge graders and multi-model matrices are deferred until we have baseline data.
5. Pin `waza` to a specific release (currently `v0.9.0`) in CI to insulate against `v0.x` schema churn.

## Consequences

Positive:

- Each PR gets a numeric score per suite; reviewers can see whether a prose change preserved skill behaviour or changed it.
- The eval directory itself becomes documentation of what each skill is supposed to do — concrete prompts and expected behaviour, separate from the prose.
- Pinning the model and executor makes results reproducible across PRs.

Negative / preconditions:

- `executor: copilot-sdk` requires an active GitHub Copilot subscription on the repository owner. Without it the workflow fails at every run. The `mock` executor was rejected because it does not exercise the real model and therefore cannot detect skill-prose regressions.
- The default `secrets.GITHUB_TOKEN` may not carry Copilot scope on every repo configuration. If the first CI run fails for that reason, the recommended workaround is to provision a fine-grained PAT with Copilot access as `secrets.WAZA_COPILOT_TOKEN` and pass it via `env: GITHUB_TOKEN`. Document the resolution in a follow-up ADR rather than silently widening token permissions.
- `waza` is `v0.x`. Schema and CLI flag changes between minor versions are expected. CI pins the version; upgrades are a deliberate, reviewable change.
- Each `waza run` consumes Copilot premium requests. With three tasks per skill and `trials_per_task: 1`, expect ~6 requests per CI run. New tasks must consider this cost.

## Alternatives considered

- **Hand-written PromptFoo configs.** Rejected: PromptFoo is provider-neutral and treats prompts as the unit of evaluation, not skills. We would have to re-implement skill discovery, trigger matching, and tool-call accounting. `waza`'s `skill:` field, behavior grader, and SKILL.md frontmatter awareness map directly onto our existing structure.
- **No automation, continue with manual review.** Rejected: described in Context. Repeated regressions in similar skill repositories (and the multi-file refactor in #19) make the cost of "no signal" concrete enough to justify the tooling investment.
- **`mock` executor only.** Rejected: `mock` confirms YAML schema validity but never invokes a model. Skill-prose regressions are invisible to it, defeating the purpose of the evaluation.

## Follow-ups

Tracked outside this ADR:

- Expand task coverage: one task per `kamae` topic file and per `kamae-review` checklist sub-file.
- Add an LLM-as-judge grader for `kamae-review` once a baseline of "what good review output looks like" is established from real runs.
- Run a small Claude-vs-GPT matrix monthly to detect provider drift.
