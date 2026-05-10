---
title: Installation
parent: English
nav_order: 0
---

# Installation

`kamae-ts` ships as a set of coding-agent skill plugins. Install them with either of the following CLIs.

## Via `gh skill`

[`gh skill`](https://cli.github.com/manual/gh_skill) is the GitHub CLI's agent skills extension.

```bash
# Install a single skill (interactive prompt for agent/scope)
gh skill install iwasa-kosui/kamae-ts kamae

# Install non-interactively for Claude Code at user scope
gh skill install iwasa-kosui/kamae-ts kamae \
  --agent claude-code --scope user

# Pin to a specific release
gh skill install iwasa-kosui/kamae-ts kamae@v1.0.0
```

## Via `skills` CLI

[`skills`](https://github.com/anthropics/skills) is Anthropic's general-purpose skill installer.

```bash
npx skills add iwasa-kosui/kamae-ts
```

This installs every skill the plugin provides at once.

## Provided skills

| Skill | Triggered when |
|-------|----------------|
| [`kamae`](https://github.com/iwasa-kosui/kamae-ts/tree/main/skills/kamae) | Writing server-side TypeScript — domain models, use cases, repositories, state transitions, error handling, boundary validation, PII protection. |
| [`kamae-review`](https://github.com/iwasa-kosui/kamae-ts/tree/main/skills/kamae-review) | Reviewing code. Walks a checklist of severity-tagged review items and cites the canonical principle in `kamae`. **Depends on `kamae` being installed** — install both together. |

## Verifying the installation

After installing, your coding agent should see `kamae` (and optionally `kamae-review`) listed among available skills. Refer to your agent's documentation for how to confirm — for example, in Claude Code, run `/skills` and look for `kamae-ts:kamae` in the list.

## Customization

Both skills load applicable rules from the following locations, in priority order:

1. `.claude/rules/*.md` (project)
2. `~/.claude/rules/*.md` (user-global)
3. The plugin's own `rules/defaults/*.md`

A rule applies to kamae-ts when its frontmatter declares `applies-to: kamae`, `applies-to: kamae-review`, or `applies-to: "*"`. See [`rules/README.md`](https://github.com/iwasa-kosui/kamae-ts/tree/main/rules) in the repository for the rule format and examples.

For full skill replacement, use Claude Code's standard skill path-shadowing — `.claude/skills/kamae/SKILL.md` overrides the installed plugin's version.
