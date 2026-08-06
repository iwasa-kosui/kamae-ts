# Infer Types from Schemas Design

## Goal

Make runtime validation schemas the single source of truth for the TypeScript representations they validate. `kamae` should derive types from schemas instead of restating the same shape, and `kamae-review` should identify duplicated schema/type definitions that can drift apart.

## Core Principle

When a runtime schema defines a boundary representation, derive the corresponding TypeScript type through the schema library's inference API. Do not repeat the same shape in a separate `type` or `interface`.

Use the API that matches the intended representation:

- Zod: `z.infer<typeof Schema>` or explicit `z.input<typeof Schema>` / `z.output<typeof Schema>` when input and output differ.
- Valibot: `v.InferInput<typeof Schema>` or `v.InferOutput<typeof Schema>`.
- ArkType: `typeof Schema.infer`.

For example:

```ts
// Bad: the schema and type can drift apart.
type CreateRequestInput = Readonly<{
  passengerId: string;
}>;

const CreateRequestInputSchema = z.object({
  passengerId: z.string().uuid(),
});

// Good: the schema is the source of truth.
const CreateRequestInputSchema = z.object({
  passengerId: z.string().uuid(),
});

type CreateRequestInput = z.infer<typeof CreateRequestInputSchema>;
```

## Generation Guidance

Update the `kamae` guidance at every relevant loading path:

- Add a concise summary to `skills/kamae/SKILL.md` so the dispatcher exposes the principle.
- Put the normative explanation and the bad/good example in `skills/kamae/boundary-defense.md`.
- Add each library's inference API to the Guidelines section of its validation-library guide:
  - `skills/kamae/validation-libraries/zod.md`
  - `skills/kamae/validation-libraries/valibot.md`
  - `skills/kamae/validation-libraries/arktype.md`

The shared boundary-defense document remains the conceptual source of truth. Library guides repeat only the short, library-specific action so they remain useful when loaded independently.

## Review Guidance

Add a boundary-defense check to `skills/kamae-review/checklist/boundary.md` that detects a hand-written `type` or `interface` whose shape duplicates an existing runtime schema.

The finding should:

- Explain that two definitions can drift apart.
- Recommend the schema library's inference API.
- Include a concrete replacement when practical.
- Default to Low severity when the definitions still match.
- Increase severity when they already disagree or the mismatch can accept, reject, or expose incorrect data.

Do not report a duplication finding when a boundary representation is intentionally converted into a semantically different domain type through an explicit parser or mapper.

## Evaluation Strategy

Follow RED-GREEN-REFACTOR for both skills.

### `kamae`

Add a task under `evals/kamae/tasks/` that supplies an existing Zod schema and asks the agent to implement code consuming the validated value. The prompt must not mention inference so the evaluation measures skill behavior rather than prompt compliance.

Task-local graders should require `z.infer`, `z.input`, or `z.output` as appropriate and reject a hand-written duplicate object type.

### `kamae-review`

Add a fixture containing a schema and a matching hand-written type, plus a task under `evals/kamae-review/tasks/`. Task-local graders should require a finding that identifies the duplicated source of truth, explains drift risk, and recommends schema inference.

Add a negative control if the existing suite structure permits a focused task: a boundary DTO is explicitly converted into a meaningfully different domain type, and the review must not flag that separation as duplication.

Run each suite first against the unchanged skill to record the baseline failure, then after the guidance changes. Run the repository dry-run validation and both real-model suites. Each aggregate score must remain at or above `0.7`.

## Risks and Mitigations

- **Overgeneralizing output inference:** transformations and defaults can make schema input and output differ. Name the input/output inference APIs explicitly.
- **Collapsing boundary and domain models:** allow distinct domain types when semantics differ and require an explicit conversion boundary.
- **Guidance drift across library documents:** keep the conceptual rule in boundary defense and limit library documents to their inference syntax.
- **Brittle graders:** scope regex graders to the new tasks and accept the valid inference variants rather than one exact spelling.

## Out of Scope

- Replacing intentionally distinct domain models with boundary DTO types.
- Mandating a specific validation library.
- Generating runtime schemas from TypeScript-only types.
- Refactoring unrelated examples that already derive their types correctly.
