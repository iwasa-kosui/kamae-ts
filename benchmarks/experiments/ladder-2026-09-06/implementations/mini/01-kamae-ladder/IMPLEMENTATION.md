# Implementation Map

## Assumptions

- Command payloads arrive as JSON objects with an `op` field.
- Employee IDs, expense IDs, and rejection reasons must contain non-whitespace text.
- Stored expense records are validated on read; malformed records are treated as infrastructure failures.
- The workspace has no runtime validation library installed, so the implementation uses small in-repo parsers and unique-symbol brands.
- Requests are sequential and this version does not attempt transactional recovery across repository, payment, and logger failures.

## Design To Files

- [src/index.ts](./src/index.ts) re-exports `createExpenseService` as required by `API.md`.
- [src/service.ts](./src/service.ts) contains the application orchestration:
  - command parsing and dispatch
  - repository reads and writes
  - payment gateway coordination
  - HTTP-style status/body mapping
  - logger event emission
- [src/validation.ts](./src/validation.ts) contains the boundary parser and branded value helpers:
  - command parsing
  - ID/email validation
  - branded types for expense, employee, and email values
- [src/expense.ts](./src/expense.ts) contains the domain model:
  - discriminated union states
  - pure transition helpers
  - response-body projection
  - diagnostic event shapes
- [src/service.test.ts](./src/service.test.ts) contains workflow, validation, privacy, and persistence tests.

## Deviations From The Frozen Design

- The design proposed a no-dependency parser approach because no validation library is installed. The implementation follows that plan instead of introducing a new dependency.
- Stored expense records keep `ownerEmail` internally because the payment gateway requires it. This is intentionally excluded from all response bodies and logger events.
- Diagnostic logging is intentionally minimal: each successful change emits only the expense id and action name.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

## Remaining Limitations

- A repository, payment, or logger failure is reported as a `500` response; the implementation does not attempt retries or rollback.
- Payment decline is the only recoverable external payment outcome. All other gateway failures map to `500`.
- The workflow assumes sequential requests only; concurrent updates and crash recovery are out of scope for this version.
