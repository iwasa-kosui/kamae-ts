---
name: validation-library
description: Auto-detect validation library from package.json
applies-to: kamae
type: library-preference
alwaysApply: false
---

# Validation library — auto-detect from package.json

Read the project's `package.json` (`dependencies` and `devDependencies`). Match the first present in this priority order:

1. `zod` → load `validation-libraries/zod.md`
2. `valibot` → load `validation-libraries/valibot.md`
3. `arktype` → load `validation-libraries/arktype.md`

Load only the matching file when boundary validation or branded-type generation is in scope. If none are present, recommend `zod` (the most common choice) or ask the user before proceeding with boundary code.

Override this default by placing a `name: validation-library` rule in `.claude/rules/` or `~/.claude/rules/` with a higher-tier `library-preference` selection.
