# Tree-Shakable Library Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kamae generate Zod with `import * as z from "zod"`, preserve each other supported library's official import convention, and prevent the Zod form from regressing.

**Architecture:** Add a task-local text grader to the existing Zod generation evaluation, then update the source library guides and their bilingual documentation mirrors. Keep this as one independently testable task because the grader, guidance, and synchronized documentation express one import contract.

**Tech Stack:** Markdown skill guides, YAML evaluation tasks, Bun, TypeScript evaluation runner.

## Global Constraints

- Zod must use exactly the namespace shape `import * as z from "zod"`, allowing only quote and whitespace variations in evaluation output.
- Valibot, ArkType, neverthrow, byethrow, fp-ts, and option-t must retain their existing library-specific import syntax.
- option-t prose must call `import { Result } from "option-t/plain_result/namespace"` a namespace-style API exposed through a named import, not namespace import syntax.
- The Zod grader must be task-local because other evaluation tasks may produce no Zod code.
- Do not migrate examples to `zod/mini`, add bundler fixtures, change `kamae-review`, or change the evaluation runner.
- Delete `docs/superpowers/specs/2026-08-06-tree-shakable-imports-design.md` after the implementation is complete, as requested by the user.

---

### Task 1: Enforce the library-specific import contract

**Files:**
- Modify: `evals/kamae/tasks/domain-modeling-discriminated-union.yaml`
- Modify: `skills/kamae/validation-libraries/zod.md`
- Modify: `docs/en/validation-libraries/zod.md`
- Modify: `docs/ja/validation-libraries/zod.md`
- Modify: `skills/kamae/result-libraries/option-t.md`
- Modify: `docs/en/result-libraries/option-t.md`
- Modify: `docs/ja/result-libraries/option-t.md`
- Delete: `docs/superpowers/specs/2026-08-06-tree-shakable-imports-design.md`

**Interfaces:**
- Consumes: the existing `kamae-domain-modeling-001` task and `compilePattern(pattern: string): RegExp` behavior in `evals/runner/regex.ts`.
- Produces: a task-local `uses_zod_namespace_import` grader and synchronized source/public guidance for Zod and option-t imports.

- [ ] **Step 1: Specify the tightened task-local grader**

Use this top-level block as the GREEN target for `evals/kamae/tasks/domain-modeling-discriminated-union.yaml`. Do not apply it until the existing narrow grader has failed the RED matrix in Step 2:

```yaml
graders:
  - type: text
    name: uses_zod_namespace_import
    config:
      regex_match:
        - "(?m)^\\s*import\\s+\\*\\s+as\\s+z\\s+from\\s+[\\x22\\x27]zod[\\x22\\x27]\\s*;?\\s*$"
      regex_not_match:
        - "(?m)^\\s*import(?!\\s*\\*\\s+as\\s+z\\s+from\\s+[\\x22\\x27]zod[\\x22\\x27]\\s*;?\\s*$)\\s*(?:[^\\r\\n]*?\\s+from\\s*)?[\\x22\\x27]zod[\\x22\\x27][^\\r\\n]*$"
```

- [ ] **Step 2: Run the controlled RED matrix, then tighten the grader**

Run:

```bash
bun -e 'import { parse } from "yaml"; import { compilePattern } from "./evals/runner/regex.ts"; const task = parse(await Bun.file("evals/kamae/tasks/domain-modeling-discriminated-union.yaml").text()); const config = task.graders.find((grader) => grader.name === "uses_zod_namespace_import").config; const passes = (source) => config.regex_match.every((pattern) => compilePattern(pattern).test(source)) && config.regex_not_match.every((pattern) => !compilePattern(pattern).test(source)); const cases = [{ name: "canonical double quotes", source: "import * as z from \"zod\";", want: true }, { name: "canonical single quotes", source: "  import * as z from '\''zod'\''  ", want: true }, { name: "named only", source: "import { z } from \"zod\";", want: false }, { name: "default only", source: "import z from \"zod\";", want: false }, { name: "canonical plus named", source: "import * as z from \"zod\";\nimport { z } from \"zod\";", want: false }, { name: "canonical plus combined named bindings", source: "import * as z from \"zod\";\nimport { z, ZodError } from \"zod\";", want: false }, { name: "canonical plus default", source: "import * as z from \"zod\";\nimport zod from \"zod\";", want: false }, { name: "canonical plus named trailing comment", source: "import * as z from \"zod\";\nimport { z } from \"zod\"; // forbidden", want: false }, { name: "canonical trailing comment", source: "import * as z from \"zod\"; // forbidden", want: false }, { name: "canonical plus side-effect import", source: "import * as z from \"zod\";\nimport \"zod\";", want: false }]; const failures = []; for (const testCase of cases) { const actual = passes(testCase.source); console.log(`${actual === testCase.want ? "PASS" : "FAIL"}: ${testCase.name} expected=${testCase.want} actual=${actual}`); if (actual !== testCase.want) failures.push(testCase.name); } if (failures.length > 0) { console.error(`FAIL: ${failures.length} focused case(s) violated the canonical-only contract`); process.exit(1); }'
```

Expected before tightening the grader: exit code 1. The canonical-plus-combined-named, canonical-plus-default, canonical-plus-commented-named, and canonical-plus-side-effect cases report `actual=true`. This proves the previous negative regex allows forbidden imports whenever a canonical line is also present.

After observing the expected failures, replace the existing grader with the Step 1 block. The positive regex requires a canonical import, while the negative regex rejects every other single-line static import from `zod`.

- [ ] **Step 3: Update the Zod source guide and public documentation**

In all three Zod files, replace:

```typescript
import { z } from "zod";
```

with:

```typescript
import * as z from "zod";
```

Immediately after the `Basic API`, `Core API`, or `基本API` heading, add one concise imperative sentence requiring this namespace form. The English source/public wording must state that Kamae uses Zod's canonical namespace import. The Japanese wording must convey the same rule naturally. Do not claim that syntax alone guarantees dead-code elimination for every bundler.

- [ ] **Step 4: Correct option-t terminology without changing its API**

Replace the three misleading lead-ins while leaving the code block unchanged:

```text
skills:  Or using the namespace-style API exposed through a named import:
English: Or use the namespace-style API exposed through a named import:
Japanese: または、named import で公開される namespace-style API を使用します:
```

The following example must remain:

```typescript
import { Result } from "option-t/plain_result/namespace";
```

- [ ] **Step 5: Delete the reviewed design document**

Delete `docs/superpowers/specs/2026-08-06-tree-shakable-imports-design.md`. It has no inbound repository references.

- [ ] **Step 6: Run the controlled GREEN matrix**

Run:

```bash
bun -e 'import { parse } from "yaml"; import { compilePattern } from "./evals/runner/regex.ts"; const task = parse(await Bun.file("evals/kamae/tasks/domain-modeling-discriminated-union.yaml").text()); const config = task.graders.find((grader) => grader.name === "uses_zod_namespace_import").config; const passes = (source) => config.regex_match.every((pattern) => compilePattern(pattern).test(source)) && config.regex_not_match.every((pattern) => !compilePattern(pattern).test(source)); const cases = [{ name: "canonical double quotes", source: "import * as z from \"zod\";", want: true }, { name: "canonical single quotes", source: "  import * as z from '\''zod'\''  ", want: true }, { name: "named only", source: "import { z } from \"zod\";", want: false }, { name: "default only", source: "import z from \"zod\";", want: false }, { name: "canonical plus named", source: "import * as z from \"zod\";\nimport { z } from \"zod\";", want: false }, { name: "canonical plus combined named bindings", source: "import * as z from \"zod\";\nimport { z, ZodError } from \"zod\";", want: false }, { name: "canonical plus default", source: "import * as z from \"zod\";\nimport zod from \"zod\";", want: false }, { name: "canonical plus named trailing comment", source: "import * as z from \"zod\";\nimport { z } from \"zod\"; // forbidden", want: false }, { name: "canonical trailing comment", source: "import * as z from \"zod\"; // forbidden", want: false }, { name: "canonical plus side-effect import", source: "import * as z from \"zod\";\nimport \"zod\";", want: false }]; const failures = []; for (const testCase of cases) { const actual = passes(testCase.source); console.log(`${actual === testCase.want ? "PASS" : "FAIL"}: ${testCase.name} expected=${testCase.want} actual=${actual}`); if (actual !== testCase.want) failures.push(testCase.name); } if (failures.length > 0) { console.error(`FAIL: ${failures.length} focused case(s) violated the canonical-only contract`); process.exit(1); }'
```

Expected: exit code 0 with all ten cases reporting `PASS`. Only canonical namespace imports with quote and whitespace variations are accepted; named, default, combined, commented, duplicate-style, and side-effect imports from `zod` are rejected.

- [ ] **Step 7: Run repository validation**

Run:

```bash
bun run evals/runner/run.ts evals/kamae/eval.yaml --dry-run --output /tmp/results-kamae-tree-shakable.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --dry-run --output /tmp/results-kamae-review-tree-shakable.json
git diff --check
```

Expected: both dry-runs print `PASS`, and `git diff --check` exits 0 with no output.

- [ ] **Step 8: Self-review and commit**

Confirm that the Zod import and instruction agree in all three files, the option-t code is unchanged in all three files, no unrelated library import changed, and the design document is absent. Then commit:

```bash
git add evals/kamae/tasks/domain-modeling-discriminated-union.yaml skills/kamae/validation-libraries/zod.md docs/en/validation-libraries/zod.md docs/ja/validation-libraries/zod.md skills/kamae/result-libraries/option-t.md docs/en/result-libraries/option-t.md docs/ja/result-libraries/option-t.md docs/superpowers/specs/2026-08-06-tree-shakable-imports-design.md docs/superpowers/plans/2026-08-06-tree-shakable-imports.md
git commit -m "fix(kamae): use canonical tree-shakable imports"
```
