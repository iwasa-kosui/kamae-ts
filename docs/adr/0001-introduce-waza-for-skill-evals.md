# ADR 0001: Introduce microsoft/waza for skill quality evaluation

- Status: Superseded by [ADR 0002](./0002-replace-waza-with-claude-code-runner.md) (2026-05-10)
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
3. Set `config.executor: mock` in each `eval.yaml`. This follows microsoft/waza's `docs/SKILLS_CI_INTEGRATION.md` best-practice §1 ("Use Mock Executor for Fast Feedback ... Pull request validation"). The maintainer runs the same suites locally with `executor: copilot-sdk` against their authenticated `copilot login` session for real-model regression checks before tagging a release.
4. Add `.github/workflows/eval.yml` that runs both suites on every pull request that touches `skills/**`, `evals/**`, `rules/**`, or `.waza.yaml`, plus on `workflow_dispatch`.
5. Use `text` and `behavior` graders only at the start. LLM-as-judge graders and multi-model matrices are deferred until we have baseline data.
6. Pin `waza` to a specific release (currently `v0.31.0`) in CI by downloading the release binary directly. `go install github.com/microsoft/waza/...` (the install path the same SKILLS_CI_INTEGRATION.md recommends) does not work today — the upstream `go.mod` still declares its module path as `github.com/spboyer/waza` after the repo was transferred to the `microsoft` org, so the Go toolchain rejects the install with a "version constraints conflict". Pin via `https://github.com/microsoft/waza/releases/download/${WAZA_VERSION}/waza-linux-amd64` instead.

## Consequences

Positive:

- Each PR gets a numeric score per suite; reviewers can see whether a prose change preserved skill behaviour or changed it.
- The eval directory itself becomes documentation of what each skill is supposed to do — concrete prompts and expected behaviour, separate from the prose.
- Pinning the model and executor makes results reproducible across PRs.

Negative / preconditions:

- **CI does not exercise the real model.** Mock-executor runs verify YAML schema, fixture wiring, grader configuration, and trigger metadata, but they cannot detect a skill-prose change that quietly degrades real-model output. The maintainer absorbs that gap by running `executor: copilot-sdk` locally before each release.
- **`copilot-sdk` is not currently usable on stock GitHub-hosted runners.** A smoke test on this PR confirmed the embedded Copilot CLI fails with `"copilot is not authenticated. Use any installed instance of copilot CLI and run \"copilot login\""` even when `secrets.GITHUB_TOKEN` is exported as `GITHUB_TOKEN` per the upstream guide. Until upstream waza ships a non-interactive auth path (env-var or PAT), automated real-model evaluation requires self-hosted runners with a pre-authenticated Copilot session — out of scope for this individual repo.
- `waza` is `v0.x`. Schema and CLI flag changes between minor versions are expected. CI pins the version; upgrades are a deliberate, reviewable change.
- Local real-model runs consume Copilot premium requests on the maintainer's account. With three tasks per skill and `trials_per_task: 1`, expect ~6 requests per local run.

## Alternatives considered

- **Hand-written PromptFoo configs.** Rejected: PromptFoo is provider-neutral and treats prompts as the unit of evaluation, not skills. We would have to re-implement skill discovery, trigger matching, and tool-call accounting. `waza`'s `skill:` field, behavior grader, and SKILL.md frontmatter awareness map directly onto our existing structure.
- **No automation, continue with manual review.** Rejected: described in Context. Repeated regressions in similar skill repositories (and the multi-file refactor in #19) make the cost of "no signal" concrete enough to justify the tooling investment.
- **`copilot-sdk` for PR CI.** Initially proposed and rejected after the smoke test above. Stock GitHub-hosted runners cannot satisfy the `copilot login` requirement non-interactively today, and microsoft/waza's own `SKILLS_CI_INTEGRATION.md` explicitly recommends `mock` for PR validation. Re-evaluate when upstream documents a non-interactive auth path.

## Follow-ups

Tracked outside this ADR:

- Expand task coverage: one task per `kamae` topic file and per `kamae-review` checklist sub-file.
- Add an LLM-as-judge grader for `kamae-review` once a baseline of "what good review output looks like" is established from real runs.
- Run a small Claude-vs-GPT matrix monthly to detect provider drift.
- Watch upstream waza for a non-interactive `copilot-sdk` auth path; once available, add a scheduled or post-merge job that runs the suites with the real executor.
