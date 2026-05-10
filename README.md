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
gh skill install iwasa-kosui/kamae-ts functional-ts

# Install non-interactively for Claude Code at user scope
gh skill install iwasa-kosui/kamae-ts functional-ts \
  --agent claude-code --scope user

# Pin to a specific release
gh skill install iwasa-kosui/kamae-ts functional-ts@v0.1.0
```

Or via [`skills` CLI](https://github.com/anthropics/skills):

```bash
npx skills add iwasa-kosui/kamae-ts
```

## Provided Skills

### `functional-ts`

Automatically triggered when writing server-side TypeScript code (domain models, use cases, repositories). Guides code generation following the principles.

### `functional-ts-review`

Triggered during code review. Detects code patterns that violate the principles (class usage, type assertions, thrown exceptions, unprotected PII, etc.) and suggests fixes.

### `functional-ts-ja` / `functional-ts-review-ja`

Japanese versions of the above skills.

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
