# Kamae-ts Redesign Design

## Goal

Restructure the kamae-ts plugin so that

1. End users can customize behavior per project via a *rules* mechanism (library preferences, check toggles, project-specific conventions, full skill replacement).
2. Token cost of installation drops by removing the duplicated `-ja` skills and adopting the dispatcher pattern from `anthropics/skills`.
3. Japanese content is preserved as readable docs (GitHub Pages) rather than as duplicate skill files.
4. The plugin follows current `anthropics/skills` conventions (`.claude-plugin/marketplace.json` with explicit `skills` array, lazy-loaded sub-files, `TRIGGER`/`SKIP` description style).

Backward compatibility is explicitly out of scope. The skill names change (`functional-ts` → `kamae`, `functional-ts-review` → `kamae-review`).

## Skill catalog

Two skills, both using the dispatcher pattern (a thin `SKILL.md` that reads sub-files only when the situation calls for them).

```
skills/
  kamae/
    SKILL.md                  # ~700 tokens, dispatcher
    domain-modeling.md
    state-modeling.md
    error-handling.md
    boundary-defense.md
    declarative-style.md
    test-data.md
    result-libraries/
      neverthrow.md
      byethrow.md
      fp-ts.md
      option-t.md
    validation-libraries/
      zod.md
      valibot.md
      arktype.md
    examples/
      *.ts
  kamae-review/
    SKILL.md                  # ~600 tokens, dispatcher
    checklist/
      classes-and-methods.md
      error-handling.md
      exhaustiveness.md
      boundary.md
      pii-protection.md
```

Granularity: two skills, not many. The trigger split is between *writing* (kamae) and *reviewing* (kamae-review). Splitting further per topic would duplicate trigger disambiguation logic across many `description` fields and fragment the cross-reference graph (kamae-review depends on kamae's definitions).

`kamae-review/checklist/` files reference `../kamae/*.md` rather than duplicating any principle text. `kamae-review` therefore depends on `kamae` being installed.

## Rules mechanism

### Layout

Rules live in the standard Claude Code rules locations, not in a kamae-ts-specific subdirectory:

| Tier | Path | Authority |
|---|---|---|
| Project | `.claude/rules/*.md` | Highest — overrides all others |
| User | `~/.claude/rules/*.md` | Falls back to defaults if absent |
| Plugin defaults | `kamae-ts/rules/defaults/*.md` | Lowest — used when no user rule covers the same `name` |

A rule applies to kamae-ts if its frontmatter declares `applies-to: kamae`, `applies-to: kamae-review`, or `applies-to: "*"`. Other rule files in `~/.claude/rules/` are ignored by the kamae skills.

### Frontmatter schema

```yaml
---
name: <kebab-case identifier, unique per kamae-ts rule>
description: <one-liner shown in rule index>
applies-to: kamae | kamae-review | "*"
type: library-preference | check-toggle | convention | override
alwaysApply: false
# Type-specific fields:
# - type: check-toggle requires `check: <named-id>` and `enabled: false`
---
```

`alwaysApply: false` keeps these rules out of the user's CLAUDE.md baseline; the kamae skills load them on demand via Step 0.

### Conflict resolution

Rules with the same `name` collide. The highest-tier file wins. Within a tier, the rule whose filename sorts last wins (deterministic).

### Discovery & consumption

Each `SKILL.md` opens with **Step 0: Load applicable rules**:

1. Glob `.claude/rules/*.md`, then `~/.claude/rules/*.md`, then `<plugin>/rules/defaults/*.md`.
2. Read each, drop any whose `applies-to` doesn't match the current skill name (or `*`).
3. Reduce by `name`, keeping the highest-tier instance.
4. Apply each surviving rule's body throughout the rest of the skill.

### Path-shadowing for full skill replacement

Already provided by Claude Code: a project's `.claude/skills/kamae/SKILL.md` overrides the installed plugin's. Kamae-ts does not re-implement this; `rules/README.md` documents it as the path-shadowing mechanism for case (d) "full skill override."

## Bilingual handling

Japanese content moves out of `skills/` and into `docs/ja/` as curated reading. The agent-process voice (`Step N: Read X`) is rewritten as explanatory prose (`X とは何か`, `なぜこうするのか`).

`functional-ts-review-ja` collapses into a single `docs/ja/code-review.md` rather than a multi-file checklist; reviewers and learners reading the docs want the whole picture, not a phased dispatcher.

GitHub Pages is enabled from `main`'s `/docs` directory using Jekyll's default config (theme `jekyll-theme-minimal`, `jekyll-relative-links`). The site URL is `https://iwasa-kosui.github.io/kamae-ts/`. Custom domain is deferred.

The legacy `-ja` skills are deleted in the same PR.

## Manifest

`.claude-plugin/marketplace.json` is added (new) following the `anthropics/skills` convention:

```json
{
  "name": "kamae-ts",
  "owner": { "name": "Kosui Iwasa" },
  "metadata": {
    "description": "Kamae (構え) — robust server-side TypeScript design harness",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "kamae-ts",
      "description": "Server-side TypeScript design and review skills",
      "source": "./",
      "strict": false,
      "skills": ["./skills/kamae", "./skills/kamae-review"]
    }
  ]
}
```

`.claude-plugin/plugin.json` is bumped from `0.1.0` to `1.0.0` to mark the breaking redesign.

## Token efficiency techniques applied

| Technique | Where |
|---|---|
| Dispatcher SKILL.md | Both `kamae/SKILL.md` and `kamae-review/SKILL.md` |
| Lazy-loaded sub-files | All topic and library guides |
| Phase gating (Step 0 → Step 1 → ...) | Both SKILL.md files |
| TRIGGER/SKIP description | Both skill descriptions |
| Drop `-ja` skills | ~50% reduction in installed skill token count |
| Knowledge-base sharing | `kamae-review/checklist/*.md` references `../kamae/*.md` rather than duplicating |
| Examples segregated from SKILL.md | `examples/*.ts` referenced only from library guides, never from SKILL.md |

## Risks

- `applies-to` is interpreted by the LLM, not enforced by tooling. Step 0 wording must be unambiguous.
- `~/.claude/rules/` is shared with non-kamae rules. Recommend (in `rules/README.md`) prefixing kamae-related rule filenames with `kamae-` for human navigability.
- Skill name change breaks any `.claude/skills/functional-ts/` shadows in user projects. Acceptable per "no backward compatibility."
- `marketplace.json` field shape is inferred from `anthropics/skills` examples and may shift; v1 uses the minimum that works today.
- `kamae-review` standalone install loses access to `../kamae/` sub-files. README states the dependency.

## Out of scope

- WIP feature branches (`feat/branded-type-guidelines`, `feat/schema-factory-guideline`, `feat/unique-symbol-brand`, `feat/bilingual-support`). They are handled separately.
- Mass rewrite of skill content. The redesign restructures and re-routes; it does not change which principles are taught.
- Custom domain for GitHub Pages.
