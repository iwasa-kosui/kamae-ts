# Kamae-ts Rules

Customize how `kamae` and `kamae-review` apply per project. Rules are markdown files with YAML frontmatter; the skills load them at the start of every invocation (Step 0) and adjust their behavior accordingly.

## Where rules live

Three tiers, highest priority first:

| Tier | Path | Authority |
|---|---|---|
| Project | `.claude/rules/*.md` (within the project repo) | Highest |
| User | `~/.claude/rules/*.md` (your dotfiles) | Falls back from project |
| Plugin defaults | `kamae-ts/rules/defaults/*.md` (inside this plugin) | Lowest, used only when no user rule covers a `name` |

Same `name` on a higher tier wins. Same `name` on the same tier is resolved by lexicographically last filename.

A rule applies to kamae-ts only when its frontmatter declares `applies-to: kamae`, `applies-to: kamae-review`, or `applies-to: "*"`. Rules without this field are ignored by the kamae skills.

## Rule frontmatter

```yaml
---
name: <kebab-case identifier, unique per kamae-ts rule>
description: <one-line summary>
applies-to: kamae | kamae-review | "*"
type: library-preference | check-toggle | convention | override
alwaysApply: false
# type-specific extra fields:
# - check-toggle: requires `check: <named-id>` and `enabled: false`
---
```

`alwaysApply: false` is the convention for kamae rules — they should not be auto-loaded into CLAUDE.md baseline; the skills load them on demand.

## Rule types

### library-preference

Selects a specific library (skips auto-detection from `package.json`). Common `name`s: `result-library`, `validation-library`.

```markdown
---
name: result-library
description: This project uses neverthrow exclusively
applies-to: kamae
type: library-preference
alwaysApply: false
---

This project uses `neverthrow` exclusively. Skip the auto-detection step in
`kamae/SKILL.md`. When error handling is in scope, load
`result-libraries/neverthrow.md` directly. Do not propose `byethrow`, `fp-ts`,
or `option-t` patterns.
```

### check-toggle

Enables or disables a specific named check. Used to silence checks that don't apply to the project.

```markdown
---
name: disable-pii-check
description: Disable PII protection check (project handles no personal data)
applies-to: kamae-review
type: check-toggle
check: pii-protection
enabled: false
alwaysApply: false
---

This project handles no personal information. Skip the PII protection check
during reviews. Do not flag bare `string` fields as missing `Sensitive<T>`.
```

The `check` field uses a named identifier (e.g., `pii-protection`), not the numeric checklist position — numbers may shift across releases.

### convention

Project-specific conventions the skills should respect when generating or reviewing code.

```markdown
---
name: brand-types-location
description: All Branded Types live in src/types/brand.ts
applies-to: kamae
type: convention
alwaysApply: false
---

In this project, all Branded Types and their companion `.schema` objects live
in `src/types/brand.ts`. When generating new Branded Types, append to that
file rather than creating a new file per concept. Reference existing brands
in that file before introducing a duplicate brand symbol.
```

### override

Replaces the guidance from a specific section of a sub-file. Reserved for advanced cases where the entire approach to a topic differs (e.g., a custom Result type).

In v1, `override` rules are honored by being read alongside other rules; the agent gives them precedence over the corresponding sub-file. Tooling does not enforce the replacement automatically.

## Replacing a whole skill

Use Claude Code's standard skill path-shadowing: a project's `.claude/skills/kamae/SKILL.md` overrides the installed plugin's. This mechanism is independent of rules and handles the case where you want to fully replace `kamae` or `kamae-review` rather than tune behavior.

## Naming convention

Rule files in `~/.claude/rules/` and `.claude/rules/` may sit alongside other tooling's rules. Prefix kamae-related rules with `kamae-` for human navigability — the skills do not enforce this but the convention helps you find them later. Example: `~/.claude/rules/kamae-result-library.md`.
