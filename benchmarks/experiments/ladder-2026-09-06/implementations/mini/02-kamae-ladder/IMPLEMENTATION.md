# Implementation Map

## Design to Files

- `src/index.ts`
  - Exports `createExpenseService(dependencies)`.
  - Dispatches commands, enforces workflow order, catches storage/gateway faults, and returns the host response shape.
- `src/domain/command.ts`
  - Parses raw JSON commands at the boundary.
  - Enforces required fields per operation before any repository lookup.
- `src/domain/expense.ts`
  - Defines the internal expense state union and pure transitions for create, submit, approve, reject, and pay.
  - Validates records loaded from storage before they re-enter the workflow.
- `src/domain/expense-id.ts`
  - Branded expense identifier and runtime parser.
- `src/domain/employee-id.ts`
  - Branded employee identifier and runtime parser.
- `src/domain/email-address.ts`
  - Email boundary check for syntactic validity.
- `src/domain/response.ts`
  - Converts internal expense state into the public response body and omits `ownerEmail`.
- `src/domain/errors.ts`
  - Centralizes HTTP-style error responses used by the adapter.
- `src/index.test.ts`
  - Exercises validation, duplicate handling, authorization, review transitions, payment behavior, privacy, and `get`.

## Deviations From `DESIGN.md`

- The design proposed Zod. This workspace does not include a validation library, so the boundary validation is implemented manually with small parsers and unique-symbol branded types.
- The design proposed a `src/domain/errors.ts` mapping helper, which is present, but the adapter returns host-shaped responses directly rather than introducing a separate application-layer result type.
- The internal expense discriminant uses `kind` instead of `state` to match the Kamae guidance. The public response body still exposes `state` as required by `API.md`.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

## Remaining Limitations

- Requests are still treated as sequential only; there is no concurrency control or crash recovery.
- Email validation is syntactic only and intentionally conservative.
- Malformed repository records are treated as storage failures and reported as `500`.
