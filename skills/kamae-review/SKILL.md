---
name: kamae-review
description: |
  Adversarial code review of server-side TypeScript for adherence to the kamae principles
  (discriminated unions, branded types, Result error handling, boundary validation, PII protection).

  TRIGGER when: reviewing a pull request, audit, or quality check of TypeScript server-side code
  involving domain models, repositories, use cases, business logic, or boundary code.
  SKIP: frontend code review, infrastructure-as-code review, test-only review, code review
  unrelated to domain logic.
license: MIT
---

# Kamae Code Review

Adversarial review against the kamae principles. The knowledge base lives in `../kamae/`; this skill links rather than duplicates.

## Review Procedure

1. **Load principle knowledge.** Before reading any code under review, read:
   - [`../kamae/SKILL.md`](../kamae/SKILL.md) — principle index
   - The validation library guide matching the project's `package.json` under [`../kamae/validation-libraries/`](../kamae/validation-libraries/) (`zod.md` / `valibot.md` / `arktype.md`)
   - The Result library guide matching the project's `package.json` under [`../kamae/result-libraries/`](../kamae/result-libraries/) (`neverthrow.md` / `byethrow.md` / `fp-ts.md` / `option-t.md`)
   - Each topic file under `../kamae/` cited by the checklist sub-files you read.

2. **Read the files under review.**

3. **Walk the checklist.** Read each checklist sub-file in order; match findings to its items.

   - [`checklist/domain-modeling.md`](./checklist/domain-modeling.md) — Discriminated Unions, Companion Objects, Branded Types, file structure (items 1.x)
   - [`checklist/state-transitions.md`](./checklist/state-transitions.md) — pure state transitions, exhaustiveness (items 2.x)
   - [`checklist/error-handling.md`](./checklist/error-handling.md) — Result types, no thrown exceptions, DU error types (items 3.x)
   - [`checklist/boundary.md`](./checklist/boundary.md) — schema validation, no `as` assertions (items 4.1, 4.2)
   - [`checklist/pii-protection.md`](./checklist/pii-protection.md) — `Sensitive<T>` for PII (item 4.3)
   - [`checklist/declarative-and-tests.md`](./checklist/declarative-and-tests.md) — array operations, events, fixtures (items 5.x, 6.x)

4. **Report findings.** For each violation:
   1. Location (`path:line`).
   2. Why it is a problem — cite the principle (link back to `../kamae/...`) and the risk of violating it.
   3. How to fix — code example showing the corrected version.

5. **Suggestions** (non-violations with room for improvement) are communicated with the same format but framed as suggestions rather than findings.

## Severity classes

Each checklist item is tagged High / Medium / Low.

- **High** — direct cause of runtime errors or compliance violations (`as`, missing PII protection, missing schema validation, missing Branded Types on semantically distinct primitives).
- **Medium** — invalid state representation, inconsistent error handling, missing exhaustiveness, catch-all type files, classes for domain models.
- **Low** — stylistic, readability, edge-case correctness (method notation, `interface` for domain types, missing `Readonly<>`, non-`kind` discriminants, imperative array loops, fixtures without `as const satisfies`).

## Example Finding

```
### Use of method notation

`src/repository/task-repository.ts:15`

`save(task: Task): Promise<void>` uses method notation. Per
[`../kamae/SKILL.md` §1 "Use function property notation"](../kamae/SKILL.md),
parameters become bivariant under method notation, so a narrower implementation
such as `save(task: DoingTask): Promise<void>` will pass type checking at the
injection site.

Suggested fix:
\`\`\`typescript
type TaskRepository = {
  save: (task: Task) => Promise<void>;
};
\`\`\`
```
