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

Select the matching library when boundary validation or branded types are in scope.
Load its guide only when implementing or verifying its API. Reusing an established
schema does not require rereading the guide. If none are present, follow an existing
custom implementation/override or ask which to introduce unless the user already
authorized that choice. Continue work that does not need a validation library.

Override this default by placing a `name: validation-library` rule in `.claude/rules/` or `~/.claude/rules/` with a higher-tier `library-preference` selection.
