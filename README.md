<p align="center">
  <img src="./docs/assets/logo.svg" alt="kamae-ts" height="120">
</p>

> 日本語版: [README.ja.md](README.ja.md)

# kamae-ts

> _Kamae (構え) — a stance of readiness._

An extensible harness of skill plugins for designing and implementing robust server-side TypeScript applications. Each skill encodes a *kamae* — a practiced stance for a specific design concern — that coding agents apply when generating or reviewing code.

The current stances focus on functional domain modeling; more will be added over time.

## Overview of Principles

- Represent domain state with **Discriminated Unions**, avoiding classes
- Define state transitions with **pure functions**, making invalid transitions compile errors
- Handle errors as values with **Result types** (neverthrow / byethrow / fp-ts / option-t), avoiding thrown exceptions
- Validate external boundaries with **schema validation** (Zod / Valibot / ArkType), trusting types inside the domain
- Protect PII at runtime with the **Sensitive type**

## Installation

Via [`gh skill`](https://cli.github.com/manual/gh_skill) (the GitHub CLI's agent skills extension):

```bash
# Install a single skill (interactive prompt for agent/scope)
gh skill install iwasa-kosui/kamae-ts kamae

# Install non-interactively for Claude Code at user scope
gh skill install iwasa-kosui/kamae-ts kamae \
  --agent claude-code --scope user

# Pin to a specific release
gh skill install iwasa-kosui/kamae-ts kamae@v1.0.0
```

Or via [`skills` CLI](https://github.com/anthropics/skills):

```bash
npx skills add iwasa-kosui/kamae-ts
```

## Provided Skills

### `kamae`

Triggered when writing server-side TypeScript code (domain models, use cases, repositories, state transitions, error handling, boundary validation, PII protection). Guides code generation through a thin dispatcher SKILL.md that lazy-loads topic sub-files (`domain-modeling.md`, `state-modeling.md`, `error-handling.md`, `boundary-defense.md`, `declarative-style.md`, `test-data.md`) and library-specific guides only when relevant.

### `kamae-review`

Triggered during code review. Walks a checklist of severity-tagged review items (split across `checklist/*.md` sub-files) and reports findings citing the canonical principle in `kamae`. Depends on `kamae` being installed for the knowledge base — install both together.

## Customization via Rules

Both skills load applicable rules at the start of each invocation, in priority order:

1. `.claude/rules/*.md` (project)
2. `~/.claude/rules/*.md` (user-global)
3. The plugin's own `rules/defaults/*.md`

A rule applies to kamae-ts when its frontmatter declares `applies-to: kamae`, `applies-to: kamae-review`, or `applies-to: "*"`. Four rule types are supported:

- `library-preference` — pin a specific Result or validation library (overrides auto-detection)
- `check-toggle` — disable a named review check (e.g., PII protection for projects with no personal data)
- `convention` — declare project-specific conventions (e.g., "Branded Types live in `src/types/brand.ts`")
- `override` — replace specific guidance from a topic sub-file

See [`rules/README.md`](./rules/README.md) for the rule format and concrete examples.

For full skill replacement, use Claude Code's standard skill path-shadowing (`.claude/skills/kamae/SKILL.md` overrides the installed plugin's).

## Evaluation

Skill quality is continuously evaluated with [`microsoft/waza`](https://github.com/microsoft/waza).

- Suites live under [`evals/kamae/`](./evals/kamae/) and [`evals/kamae-review/`](./evals/kamae-review/).
- [`.github/workflows/eval.yml`](./.github/workflows/eval.yml) runs both suites on every `pull_request` that touches `skills/**`, `evals/**`, `rules/**`, or `.waza.yaml`, using the `copilot-sdk` executor.
- See [ADR 0001](./docs/adr/0001-introduce-waza-for-skill-evals.md) for adoption rationale and preconditions.

## Documentation

A reading version of the principles is published at [https://iwasa-kosui.github.io/kamae-ts/](https://iwasa-kosui.github.io/kamae-ts/), in both [English (`/en/`)](https://iwasa-kosui.github.io/kamae-ts/en/) and [Japanese (`/ja/`)](https://iwasa-kosui.github.io/kamae-ts/ja/).

## Reference Articles

These principles are based on the following articles:

- [Complex state transitions: Expressing state definitions and transitions with functions and Discriminated Unions instead of classes](https://kosui.me/posts/2025/02/20/005900)
- [Implementing the State pattern with Discriminated Unions](https://kosui.me/posts/2025/02/25/021320)
- [Designing TypeScript code for easy domain event recording](https://kosui.me/posts/2025/05/06/142842)
- [Why you should avoid method notation in TypeScript](https://kosui.me/posts/2025/06/02/221656)
- [Why I prefer type over interface in TypeScript](https://kosui.me/posts/2025/10/23/214710)
- [Preventing PII leaks in logs: TypeScript type inference and runtime boundaries](https://kosui.me/posts/2026/03/16/typescript-pii-logging-defense)
- [How to teach server-side TypeScript's type system](https://kakehashi-dev.hatenablog.com/entry/2026/03/31/110000)
- [as const satisfies is useful for TypeScript tests](https://kakehashi-dev.hatenablog.com/entry/2025/12/14/110000)
- [Declarative array operations in TypeScript](https://kakehashi-dev.hatenablog.com/entry/2025/11/19/110000)
- [TypeScript class pitfalls for developers from other languages](https://kakehashi-dev.hatenablog.com/entry/2025/08/19/110000)

## License

MIT
