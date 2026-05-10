---
name: result-library
description: Auto-detect Result library from package.json
applies-to: kamae
type: library-preference
alwaysApply: false
---

# Result library — auto-detect from package.json

Read the project's `package.json` (`dependencies` and `devDependencies`). Match the first present in this priority order:

1. `neverthrow` → load `result-libraries/neverthrow.md`
2. `@praha/byethrow` (or `byethrow`) → load `result-libraries/byethrow.md`
3. `fp-ts` → load `result-libraries/fp-ts.md`
4. `option-t` → load `result-libraries/option-t.md`

Load only the matching file when error handling is in scope. If none are present, ask the user which to introduce before proceeding with error-handling code.

Override this default by placing a `name: result-library` rule in `.claude/rules/` or `~/.claude/rules/` with a higher-tier `library-preference` selection.
