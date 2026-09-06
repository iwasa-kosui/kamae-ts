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

Read code before topic knowledge. Stop deepening each check when evidence resolves
it; complete other applicable checks before finishing. Do not read
`../kamae/SKILL.md` as a prerequisite.

## 0. Establish context once

- Load rule frontmatter from the worktree root’s `.claude/rules/*.md`,
  `~/.claude/rules/*.md`, then
  [`../../rules/defaults/*.md`](../../rules/defaults/). Keep `applies-to: kamae-review`
  or `*`; group by `name`. Project > user > defaults; same-tier last filename
  lexicographically wins. Apply surviving bodies. `check-toggle` with `enabled: false`
  skips its named `check`; conventions and overrides replace corresponding guidance.
  Read [rule format](../../rules/README.md) only if needed.
- Read selected code and direct callers, schemas, or adapters needed to trace its
  behavior. Respect local coding/import conventions. Inspect the same package's
  `package.json` only when library semantics matter.

## 1. Scan every row, briefly

Track **pass / concern / N/A** internally for each applicable occurrence, not just
one example per row. N/A means absent or disabled. Missing evidence means concern,
not pass. The linked checks retain their IDs and exceptions.

| Present in reviewed flow | Pass question | If no or uncertain |
| --- | --- | --- |
| External inputs / assertions | Request/DB/queue/file/env values parsed before domain use, without unsafe casts? Boundary types inferred from schemas? | [Boundary 4.1, 4.2, 4.4](checklist/boundary.md) |
| PII | Wrapped in `Sensitive<T>`, redacted on serialization/logging, unwrapped only at authorized use? | [PII 4.3](checklist/pii-protection.md) |
| Domain types | Invalid combinations excluded, distinct primitives branded? Readonly `type`, `kind`, same-name companion; branded schemas exposed as `.schema`, function properties, one concept per file? | [Domain 1.1–1.9](checklist/domain-modeling.md) |
| Transitions / union switches | Pure decisions using values, not injected I/O? Valid transition sources, explicit targets, exhaustive switches with `assertNever`? Decision entrypoints may narrow a union and return InvalidState. | [States 2.x](checklist/state-transitions.md) |
| Expected failure | Returned as a typed Result variant with context fields, rather than thrown? | [Errors 3.1–3.2](checklist/error-handling.md) |
| Catch / error mapper | Unknown technical faults rethrown, rather than wrapped or renamed into a domain Result? A named external failure belongs there only with documented recovery. | [Errors 3.1](checklist/error-handling.md) |
| Async wrapper | Rejectable I/O kept out of `fromSafePromise` / equivalent safe wrappers? | [Errors 3.1](checklist/error-handling.md) |
| Result pipeline | No needless unwrap/rewrap or multi-branch combinator callbacks? | [Errors 3.3](checklist/error-handling.md) |
| I/O contracts | Separate single-operation resolvers/stores beside the domain concept, no dedicated `port/` or `ports/` folder or infrastructure imports? Atomic writes preserved? | [Domain 1.10–1.11](checklist/domain-modeling.md) |
| Collections / events / predicates / fixtures | Direct array operations, immutable required events, no redundant inferred type predicates, `as const satisfies` fixtures? | [Style/tests 5.x, 6.x](checklist/declarative-and-tests.md) |

Catch check: `catch (x: unknown) { return err({ kind: "AnyName", detail: x }); }`
is a **Medium finding** when `x` is an arbitrary technical fault. A typed wrapper
does not make it recoverable. Require a specific recovery decision; otherwise
propagate the fault. Do not recommend that wrapper as the fix for another finding.

## 2. Climb only for an unresolved check

1. **Local evidence:** Trace the value, caller, or error to its actual boundary.
   An upstream parse or project convention may resolve the concern.
2. **Checklist:** Read only the linked checklist for remaining concerns. Apply its
   conditions, exceptions, and severity; keywords alone are not findings.
3. **Topic/API detail:** Read only a cited topic or matching library guide when the
   checklist cannot settle behavior or correction. Follow library-preference overrides;
   otherwise use the affected code's library/version. Guides:
   [Result](../kamae/result-libraries/) / [validation](../kamae/validation-libraries/).
4. **Focused verification:** Still uncertain? Run an available focused test/typecheck
   or inspect the missing caller. Unavailable evidence is a reported limitation,
   not a confirmed violation or a clean review.

Always verify rejectable I/O wrappers and fp-ts execution against the matching Result
guide. Without documented recovery, fix unsafe I/O wrappers by propagating rejection;
do not suggest catch-all `fromPromise` mapping. fp-ts may transport unexpected
faults separately and rethrow at the native Promise boundary. Do not flag propagating
assertions/unexpected faults or private sentinels caught locally while other errors
are rethrown. Renaming catch-all technical errors does not make them business outcomes.

## 3. Report and stop

- Confirmed findings, highest severity first: **[severity] `path:line` — problem,
  concrete consequence, smallest correction**, linked to the relevant principle.
  Include a short code example only when needed to clarify the fix.
- Check the proposed correction against the same rows before reporting it. Give
  one valid fix, not alternatives that recreate another finding (for example,
  replacing `fromSafePromise` with a catch-all `fromPromise` mapper).
- Use checklist severity: **High** for unsafe boundaries/PII/distinct unbranded
  primitives; **Medium** for invalid states, error-channel or domain dependency
  violations; **Low** for conventions and matching schema/type duplication.
  Actual schema/type drift uses demonstrated impact. Port placement alone is Low;
  cite an outward dependency before raising it to Medium.
- Deduplicate root causes. Keep optional suggestions separate. If no findings are
  confirmed, say so and state any unverified scope/checks.
- Do not dump the checklist, rewrite files, or restart a full pass after resolving
  applicable rows. Review does not authorize edits.
