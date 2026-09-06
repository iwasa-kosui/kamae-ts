---
name: kamae
description: |
  Kamae (構え) — robust server-side TypeScript design. Functional domain modeling with
  discriminated unions, pure state transitions, Result types, schema-validated boundaries,
  and PII protection.

  TRIGGER when: writing TypeScript domain models, use cases, repositories, state transitions,
  error handling, boundary validation, or PII handling on the server side; designing types
  for business logic; implementing entity/value-object semantics in TS.
  SKIP: frontend React/Vue components, browser code, build tooling, code generation scripts,
  pure infrastructure-as-code; code unrelated to domain logic.
license: MIT
---

# Kamae — Functional Domain Modeling in TypeScript

Choose the smallest design that satisfies the task and the checks below. Do not
narrate every rung or load every guide.

## 0. Establish context once

- Read affected code and callers; identify inputs, decisions, outputs, and I/O.
- Load rule frontmatter from the worktree root’s `.claude/rules/*.md`,
  `~/.claude/rules/*.md`, then
  [`../../rules/defaults/*.md`](../../rules/defaults/). Keep `applies-to: kamae`
  or `*`; group by `name`. Project > user > defaults; same-tier last filename
  lexicographically wins. Apply surviving bodies: `library-preference` selects
  libraries, `convention` sets style, `override` replaces topic guidance.
  Read [rule format](../../rules/README.md) only if needed.
- Follow established coding/import conventions in the same package. Read its
  `package.json` once when library choice matters; reuse existing types and schemas.

## 1. Choose the first sufficient rung

For each required change, try in order. Stop adding structure once the task and
all applicable checks in step 2 are satisfied. Different responsibilities may need
different rungs.

1. **Reuse:** Existing schema, type, helper, or installed API does it? Use it.
   Reusing a schema means deriving its matching type, not keeping a copied shape:
   `type Parsed = Readonly<z.infer<typeof Schema>>` replaces `type Parsed = { ... }`.
   Use `z.input` for raw input and `z.output` / `z.infer` for parsed output.
2. **Constrain data:** A type/schema change suffices? Brand distinct IDs/values,
   infer schema-backed types, use a `kind` union for state-specific data.
3. **Compute a decision:** Behavior remains? Add a pure companion-object function.
   Transitions accept valid source states and return explicit targets; decision
   entrypoints may narrow a union and return an expected-error `Result`.
4. **Coordinate effects:** I/O required? Read at the workflow edge, pass values
   (including time/IDs) into decisions, then persist. Inject required operations
   through domain-owned contracts; keep concrete adapters outside.

Do not add states, events, dependencies, or abstractions for hypothetical needs.
Validation, privacy, error handling, and atomic writes required by the task remain
mandatory at every rung. Reused code must also pass the affected-flow checks.

## 2. Check the affected flow

Mark each row internally **pass / fix / N/A**. N/A requires evidence that the
concern is absent. Uncertainty requires the linked detail; it is not a pass.

| When present | Check | Detail for fix/uncertainty |
| --- | --- | --- |
| External data / assertions | Parse request/DB/queue/file/env data before domain use. No assertions except `as const` / `as const satisfies Type`. | [Boundary](boundary-defense.md) |
| Schema and matching handwritten type | One source of truth: infer the represented input/output side from the schema. Preserve export names, not duplicated shapes. | [Boundary](boundary-defense.md) |
| PII | Schema-wrap in `Sensitive<T>`; redact serialization/logging; unwrap only at authorized use. | [Boundary](boundary-defense.md) |
| Domain data | Distinct primitives branded; invalid combinations excluded. Readonly `type`, same-name companion; branded schemas exposed as `.schema`, function properties, one concept per file. | [Domain](domain-modeling.md) |
| State changes / union switches | Pure decisions using values, not injected I/O; valid source and explicit target; exhaustive union handling with `assertNever`. Required events immutable. | [States](state-modeling.md) |
| Failure | Expected failures: typed `Result` variants with context fields. External failures: Result only for documented recovery. Unexpected faults: application boundary, never catch-all domain errors. | [Errors](error-handling.md) |
| I/O dependency | Separate single-operation resolvers/stores beside their domain concept; no dedicated `port/` or `ports/` folder or infrastructure imports. Preserve atomic state/event writes. | [Domain](domain-modeling.md) |
| Collections / Result pipelines | Direct array operations, inferred predicates, named decision steps; avoid mutation and multi-branch combinator callbacks. | [Style](declarative-style.md), [Errors](error-handling.md) |
| Test data | Preserve literals with `as const satisfies Type`. | [Fixtures](test-data.md) |

## 3. Resolve only what is missing

Read the relevant topic once per fix/uncertainty. Load a library guide when
implementing/verifying its API; examples only if the guide is insufficient.
Select from dependencies/devDependencies unless a rule overrides:

- Result: [neverthrow](result-libraries/neverthrow.md) >
  [@praha/byethrow or byethrow](result-libraries/byethrow.md) >
  [fp-ts](result-libraries/fp-ts.md) > [option-t](result-libraries/option-t.md).
- Validation: [zod](validation-libraries/zod.md) >
  [valibot](validation-libraries/valibot.md) > [arktype](validation-libraries/arktype.md).

Missing library: continue independent work. For dependent work, use an existing
custom implementation/override or ask about a library unless that choice is authorized.

Always consult the Result guide for rejectable I/O wrappers or fp-ts execution.
Never claim a rejecting Promise is safe. fp-ts transports unexpected faults in a
separate execution channel and rethrows at a native Promise boundary. A private
sentinel is allowed only when its local boundary catches it and rethrows all other
values; see [errors](error-handling.md).

## 4. Verify and stop

Run required project checks and focused checks for changed behavior, including
failure paths. Fix failures and revisit affected rows, without restarting all reading.
Report changes, verification, and unresolved limits concisely. Explain justified
deviations briefly at the relevant code; respect project overrides. Do not expand
the task to make unrelated code conform.
