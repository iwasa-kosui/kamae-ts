# Infer Types from Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `kamae` derive boundary types from runtime schemas and make `kamae-review` flag hand-written types that duplicate those schemas.

**Architecture:** Put the normative, library-neutral rule in boundary defense, repeat only library-specific inference syntax in each validation guide, and expose the rule through the dispatcher summary. Add a matching review checklist item and task-local real-model graders for generation and review behavior.

**Tech Stack:** Markdown skills, YAML eval tasks, TypeScript fixtures, Bun eval runner, Zod / Valibot / ArkType examples.

## Global Constraints

- Treat a runtime validation schema as the single source of truth for the representation it validates.
- Derive schema-backed types with the library's inference API instead of restating the same shape in a `type` or `interface`.
- Distinguish schema input from output when transforms or defaults make them different.
- Allow a separate domain type only when it is semantically different from the boundary representation and an explicit parser or mapper performs the conversion.
- Apply the rule to both `kamae` generation and `kamae-review` findings.
- Keep task-specific semantic graders in the new task YAML files; do not add them to suite-global graders.
- Keep aggregate real-model score at or above `0.7` for both suites.
- Delete `docs/superpowers/specs/2026-08-06-infer-types-from-schemas-design.md` only after implementation and final verification.

---

### Task 1: Add regression evaluations and capture RED

**Files:**
- Create: `evals/kamae/fixtures/schemas/create-task-input.ts`
- Create: `evals/kamae/tasks/schema-type-inference.yaml`
- Create: `evals/kamae-review/fixtures/violations/duplicated-schema-type.ts`
- Create: `evals/kamae-review/tasks/flag-duplicated-schema-type.yaml`

**Interfaces:**
- Consumes: the runner's task-local `graders` support and fixture paths relative to each suite's `fixtures/` directory.
- Produces: one generation task requiring schema inference and one review task requiring a drift-risk finding and inference recommendation.

- [ ] **Step 1: Create the generation fixture**

Create `evals/kamae/fixtures/schemas/create-task-input.ts`:

```typescript
import { z } from "zod";

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["Normal", "Urgent"]),
});
```

- [ ] **Step 2: Create the generation task with task-local graders**

Create `evals/kamae/tasks/schema-type-inference.yaml`:

```yaml
id: kamae-schema-type-inference-001
name: Derive a boundary input type from its existing schema
description: |
  Positive case. An existing Zod schema defines an HTTP request body. The
  expected output derives the named TypeScript type from that schema instead
  of restating the same object shape.

inputs:
  prompt: |
    Implement server-side TypeScript code for creating a task.

    An existing `CreateTaskInputSchema` validates the HTTP request body.
    Provide:
      1. A named `CreateTaskInput` type
      2. A `parseCreateTaskInput(raw: unknown)` function
      3. A `createTask(input: CreateTaskInput)` function

    Read the provided schema and package.json, and apply the conventions
    appropriate to the project's dependencies. Return the implementation as
    TypeScript code.
  files:
    - path: package.json
    - path: schemas/create-task-input.ts

expected:
  outcomes:
    - type: task_completed

graders:
  - type: text
    name: infers_type_from_zod_schema
    config:
      regex_match:
        - '(?s)type\s+CreateTaskInput\s*=\s*z\.(?:infer|input|output)\s*<\s*typeof\s+CreateTaskInputSchema\s*>'
  - type: text
    name: does_not_restate_schema_shape
    config:
      regex_not_match:
        - '(?s)(?:type\s+CreateTaskInput\s*=\s*(?:Readonly\s*<\s*)?\{|interface\s+CreateTaskInput\s*\{)'
```

- [ ] **Step 3: Create the review fixture**

Create `evals/kamae-review/fixtures/violations/duplicated-schema-type.ts`:

```typescript
import { z } from "zod";

export type CreateTaskInput = Readonly<{
  title: string;
  priority: "Normal" | "Urgent";
}>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["Normal", "Urgent"]),
});

export const parseCreateTaskInput = (raw: unknown) =>
  CreateTaskInputSchema.safeParse(raw);
```

- [ ] **Step 4: Create the review task with task-local graders**

Create `evals/kamae-review/tasks/flag-duplicated-schema-type.yaml`:

```yaml
id: kamae-review-schema-type-inference-001
name: Flag a hand-written type that duplicates a schema
description: |
  Adversarial case. The fixture maintains a Zod schema and a matching
  hand-written type as two sources of truth. The reviewer should explain the
  drift risk and recommend deriving the type from the schema.

inputs:
  prompt: |
    Review the attached TypeScript file as part of a pull request and report
    findings against the kamae principles. Cite the relevant principle for
    each finding and tag severity (High / Medium / Low / Suggestion).
  files:
    - path: violations/duplicated-schema-type.ts

expected:
  outcomes:
    - type: task_completed

graders:
  - type: text
    name: identifies_duplicated_schema_type
    config:
      regex_match:
        - '(?i)duplicat(?:e|ed|ion)|two sources of truth|restate'
        - '(?i)\bdrift(?:s|ed|ing)?\b|out of sync|single source of truth'
  - type: text
    name: recommends_schema_inference
    config:
      regex_match:
        - '(?i)z\.(?:infer|input|output)\s*<'
  - type: text
    name: defaults_matching_definitions_to_low
    config:
      regex_match:
        - '(?i)\bLow\b'
```

- [ ] **Step 5: Validate the eval authoring**

Run:

```bash
bun run evals/runner/run.ts evals/kamae/eval.yaml --dry-run --output /tmp/kamae-schema-inference-dry-run.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --dry-run --output /tmp/kamae-review-schema-inference-dry-run.json
```

Expected: both commands exit `0`; every fixture path resolves and every regex compiles.

- [ ] **Step 6: Run the unchanged skills and record the baseline**

Run:

```bash
bun run evals/runner/run.ts evals/kamae/eval.yaml --output /tmp/kamae-schema-inference-baseline.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --output /tmp/kamae-review-schema-inference-baseline.json
```

Expected: record the task-local grader results and the model's actual output for both skills. The review task must expose the missing Low-severity calibration. If the generation task already derives the type from the schema consistently, retain it as a regression guard for existing behavior and treat the prose change as an explicit user-requested rule rather than manufacturing a failure. Do not encode the desired answer into either prompt.

- [ ] **Step 7: Commit the regression evaluations**

```bash
git add evals/kamae/fixtures/schemas/create-task-input.ts evals/kamae/tasks/schema-type-inference.yaml evals/kamae-review/fixtures/violations/duplicated-schema-type.ts evals/kamae-review/tasks/flag-duplicated-schema-type.yaml
git commit -m "test: cover schema-derived types"
```

---

### Task 2: Teach `kamae` to derive types from schemas

**Files:**
- Modify: `skills/kamae/SKILL.md` under `### Boundary Defense`
- Modify: `skills/kamae/boundary-defense.md` under `## Schema-Based Validation`
- Modify: `skills/kamae/validation-libraries/zod.md` under `## Guidelines`
- Modify: `skills/kamae/validation-libraries/valibot.md` under `## Guidelines`
- Modify: `skills/kamae/validation-libraries/arktype.md` under `## Guidelines`
- Test: `evals/kamae/tasks/schema-type-inference.yaml`

**Interfaces:**
- Consumes: the failing `infers_type_from_zod_schema` and `does_not_restate_schema_shape` graders from Task 1.
- Produces: a library-neutral source-of-truth rule plus exact inference syntax for Zod, Valibot, and ArkType.

- [ ] **Step 1: Expose the rule through the dispatcher summary**

Under `### Boundary Defense — [boundary-defense.md](./boundary-defense.md)` in `skills/kamae/SKILL.md`, add this sentence immediately after the existing schema-validation statement:

```markdown
When a runtime schema already defines a boundary representation, derive its TypeScript type from the schema instead of restating the same shape.
```

- [ ] **Step 2: Add the normative rule and example**

In `skills/kamae/boundary-defense.md`, add `### Infer Types from Schemas` under `## Schema-Based Validation`, before `### Use safeParse`. Include this text and example:

````markdown
### Infer Types from Schemas

Treat a runtime validation schema as the single source of truth for the representation it validates. When a schema already defines a value's shape, derive its TypeScript type from the schema instead of restating the shape as a separate `type` or `interface`; duplicated definitions can drift apart.

Use input or output inference intentionally when a schema transforms values or supplies defaults. Define a separate domain type only when it intentionally differs from the boundary representation, and make the conversion explicit in a parser or mapper.

```typescript
// Bad: the schema and type can drift apart
type CreateRequestInput = Readonly<{
  passengerId: string;
}>;

const CreateRequestInputSchema = z.object({
  passengerId: z.string().uuid(),
});

// Good: the schema is the source of truth
const CreateRequestInputSchema = z.object({
  passengerId: z.string().uuid(),
});

type CreateRequestInput = z.infer<typeof CreateRequestInputSchema>;
```

With Zod, use `z.input<typeof Schema>` and `z.output<typeof Schema>` when input and output differ. For Valibot and ArkType syntax, use the detected library guide.
````

- [ ] **Step 3: Add Zod-specific guidance**

Add this as the first bullet under `## Guidelines` in `skills/kamae/validation-libraries/zod.md`:

```markdown
- When a schema defines a representation, derive its type with `z.infer<typeof Schema>`. Use `z.input<typeof Schema>` and `z.output<typeof Schema>` explicitly when transforms or defaults make the input and output differ; do not restate the shape in a separate `type` or `interface`.
```

- [ ] **Step 4: Add Valibot-specific guidance**

Add this as the first bullet under `## Guidelines` in `skills/kamae/validation-libraries/valibot.md`:

```markdown
- When a schema defines a representation, derive its type with `v.InferInput<typeof Schema>` or `v.InferOutput<typeof Schema>` as appropriate; do not restate the shape in a separate `type` or `interface`.
```

- [ ] **Step 5: Add ArkType-specific guidance**

Add this as the first bullet under `## Guidelines` in `skills/kamae/validation-libraries/arktype.md`:

```markdown
- When a schema defines a representation, derive its type with `typeof Schema.infer`; do not restate the shape in a separate `type` or `interface`.
```

- [ ] **Step 6: Verify GREEN for `kamae`**

Run:

```bash
bun run evals/runner/run.ts evals/kamae/eval.yaml --dry-run --output /tmp/kamae-schema-inference-after-dry-run.json
bun run evals/runner/run.ts evals/kamae/eval.yaml --output /tmp/kamae-schema-inference-after.json
```

Expected: dry-run exits `0`, all tasks pass, the new task-specific graders pass, and aggregate score is at least `0.7`.

- [ ] **Step 7: Commit the generation guidance**

```bash
git add skills/kamae/SKILL.md skills/kamae/boundary-defense.md skills/kamae/validation-libraries/zod.md skills/kamae/validation-libraries/valibot.md skills/kamae/validation-libraries/arktype.md
git commit -m "feat(kamae): derive types from schemas"
```

---

### Task 3: Teach `kamae-review` to flag duplicated schema types

**Files:**
- Modify: `skills/kamae-review/checklist/boundary.md`
- Modify: `skills/kamae-review/SKILL.md`
- Test: `evals/kamae-review/tasks/flag-duplicated-schema-type.yaml`

**Interfaces:**
- Consumes: the failing review graders from Task 1 and the inference terminology introduced in Task 2.
- Produces: review guidance that defaults matching duplicate definitions to Low severity and escalates based on actual mismatch impact.

- [ ] **Step 1: Add checklist item 4.4**

After item 4.2 in `skills/kamae-review/checklist/boundary.md`, add:

````markdown
## 4.4 Are schema-backed types inferred from their schemas? — Low

Flag a hand-written `type` or `interface` that restates the same shape as an existing runtime validation schema. The duplicated definitions create two sources of truth and can drift apart. Recommend the library's inference API and show a concrete replacement when practical:

```typescript
type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
```

Use Low while the definitions still match. Raise severity when they already disagree or the mismatch can cause incorrect acceptance, rejection, or data exposure.

Do not flag a boundary representation that is explicitly parsed or mapped into a semantically different domain type.
````

- [ ] **Step 2: Expose the new check in the review procedure**

In the boundary checklist entry under `## Review Procedure` in `skills/kamae-review/SKILL.md`, include `schema-derived types` and item `4.4` alongside items 4.1 and 4.2.

- [ ] **Step 3: Calibrate severity guidance**

In `## Severity classes` in `skills/kamae-review/SKILL.md`, add matching schema/type duplication as a Low example and state that an existing mismatch is raised according to its acceptance, rejection, or exposure impact.

- [ ] **Step 4: Verify GREEN for `kamae-review`**

Run:

```bash
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --dry-run --output /tmp/kamae-review-schema-inference-after-dry-run.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --output /tmp/kamae-review-schema-inference-after.json
```

Expected: dry-run exits `0`, all tasks pass, the new task-specific graders pass, and aggregate score is at least `0.7`.

- [ ] **Step 5: Commit the review guidance**

```bash
git add skills/kamae-review/checklist/boundary.md skills/kamae-review/SKILL.md
git commit -m "feat(kamae-review): flag duplicated schema types"
```

---

### Task 4: Remove the implemented design document and run final verification

**Files:**
- Delete: `docs/superpowers/specs/2026-08-06-infer-types-from-schemas-design.md`
- Verify: all files changed by Tasks 1–3

**Interfaces:**
- Consumes: completed and reviewed generation/review guidance.
- Produces: a clean branch with the requested design document removed and fresh full-suite evidence.

- [ ] **Step 1: Delete the implemented design document**

Delete only:

```text
docs/superpowers/specs/2026-08-06-infer-types-from-schemas-design.md
```

- [ ] **Step 2: Run final authoring validation**

Run:

```bash
bun run evals/runner/run.ts evals/kamae/eval.yaml --dry-run --output /tmp/kamae-final-dry-run.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --dry-run --output /tmp/kamae-review-final-dry-run.json
```

Expected: both commands exit `0` with no schema, fixture, or regex errors.

- [ ] **Step 3: Run final real-model verification**

Run:

```bash
bun run evals/runner/run.ts evals/kamae/eval.yaml --output /tmp/kamae-final.json
bun run evals/runner/run.ts evals/kamae-review/eval.yaml --output /tmp/kamae-review-final.json
```

Expected: every task passes and both aggregate scores are at least `0.7`.

- [ ] **Step 4: Inspect the final diff and repository state**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intentional design-document deletion remains uncommitted at this step.

- [ ] **Step 5: Commit the design-document cleanup**

```bash
git add docs/superpowers/specs/2026-08-06-infer-types-from-schemas-design.md
git commit -m "docs: remove implemented schema inference design"
```
