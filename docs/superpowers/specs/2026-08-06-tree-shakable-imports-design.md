# Tree-Shakable Library Imports Design

## Goal

Generate Zod code with the canonical namespace import:

```typescript
import * as z from "zod";
```

Keep import guidance library-specific instead of applying one import style to every dependency. Add an evaluation guard so the Zod form cannot silently regress.

## Research conclusions

The supported libraries expose different canonical APIs, so a global "always use namespace imports" rule would be incorrect.

| Library | Canonical style retained by Kamae | Decision |
| --- | --- | --- |
| Zod | `import * as z from "zod"` | Change the current named import to match the official documentation. |
| Valibot | `import * as v from "valibot"` | Keep the existing namespace import. Valibot documents both individual and wildcard imports and uses the wildcard form throughout its guides. |
| ArkType | `import { type } from "arktype"` | Keep the existing named import. |
| neverthrow | Named imports from `neverthrow` | Keep the existing form used by the official documentation. |
| byethrow | `import { Result } from "@praha/byethrow"` | Keep the existing tree-shakable named API. |
| fp-ts | Namespace imports from package subpaths | Keep the existing `fp-ts/Either` and `fp-ts/TaskEither` forms required by its code conventions. |
| option-t | Named imports from focused subpaths | Keep the existing API, but correct prose that currently calls the syntax a namespace import. |

Namespace syntax alone does not guarantee dead-code elimination across every bundler. Regular Zod prioritizes its method-based API; applications with unusually strict bundle-size requirements can choose `zod/mini`, whose functional API is designed for finer-grained tree-shaking. Migrating generated examples to `zod/mini` would change the API and is outside this change.

## Skill changes

Update `skills/kamae/validation-libraries/zod.md` so its primary example uses the namespace import and the surrounding instruction makes that form the required Zod convention.

Update `skills/kamae/result-libraries/option-t.md` to describe its `/namespace` entry point as a namespace-style API exposed through a named import. Do not change the executable example.

Keep the public English and Japanese documentation synchronized with both source-guide changes:

- `docs/en/validation-libraries/zod.md`
- `docs/ja/validation-libraries/zod.md`
- `docs/en/result-libraries/option-t.md`
- `docs/ja/result-libraries/option-t.md`

No other library guide needs a syntax change based on the official documentation reviewed for this design.

## Evaluation design

Extend the existing Zod-generating Kamae task with task-local text graders:

- require `import * as z from "zod"` while tolerating normal quote and whitespace variations;
- reject `import { z } from "zod"`;
- leave the rule task-local because some suite tasks intentionally produce no Zod code.

The current Zod guide itself provides the RED baseline because it explicitly teaches the form the new grader will reject. The repository's real-model runner cannot currently complete locally because the host safety hook rejects its nested `claude -p` invocation. Dry-run validation remains available; a fresh subagent can provide a forward test of the edited skill without changing the runner.

## Verification

1. Confirm the new task-local grader fails against the current named-import form.
2. Apply the minimal guide and documentation changes.
3. Run both evaluation suites in `--dry-run` mode.
4. Forward-test the edited Kamae skill on the Zod generation task and inspect the import manually.
5. Run the real-model suite if the nested CLI restriction is removed; otherwise report the environmental blocker without weakening the grader.
6. Review the final diff for consistency across the skill source and bilingual documentation.

## Out of scope

- Migrating examples from regular Zod to `zod/mini`.
- Adding bundle-size measurements or bundler-specific fixtures.
- Enforcing one import syntax across all supported libraries.
- Adding import-style findings to `kamae-review`.
- Changing the evaluation runner or the host safety hook.
