# Implementation Notes

## Design To Files

- `src/index.ts`
  - Exports `createExpenseService(dependencies)` as required by `API.md`.
- `src/expense-service.ts`
  - Owns the application workflow, dependency orchestration, status mapping, storage reads/writes, payment calls, and logger emission.
  - Parses commands at the boundary and maps all outcomes to `{ status, body }`.
- `src/command.ts`
  - Validates incoming command payloads and normalizes them into the six supported command variants.
- `src/expense.ts`
  - Defines the expense lifecycle as a discriminated union and the pure state transitions between states.
- `src/public-expense.ts`
  - Projects internal expense state to the public response body without owner email.
- `src/logger-event.ts`
  - Defines the diagnostic event shape and constructors for successful lifecycle changes.
- `src/expense-id.ts`
  - Branded expense identifier type and parser.
- `src/employee-id.ts`
  - Branded employee identifier type and parser.
- `src/email-address.ts`
  - Branded email address type and parser.
- `src/receipt-id.ts`
  - Branded receipt identifier type and parser.
- `src/assert-never.ts`
  - Exhaustiveness helper for state and command dispatch.
- `src/expense-service.test.ts`
  - Lifecycle, validation, idempotency, privacy, and conflict-path coverage.

## Deviations From `DESIGN.md`

- The design assumed `zod` and a Result library, but neither was present in `package.json`.
- I implemented boundary validation with local runtime guards and implemented expected failures with direct discriminated-union responses instead of an external Result package.
- Email validation uses a pragmatic syntactic check rather than a library schema. This satisfies the PRD requirement for syntactic validity, but it is not a full RFC parser.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

## Remaining Limitations

- Requests are still sequential only; there is no concurrency control or crash recovery, matching the PRD scope.
- Storage corruption or gateway misuse is reported as `500`, but there is no recovery/retry layer.
- The email syntax check is intentionally simple and may reject uncommon but technically valid addresses.
