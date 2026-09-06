# Implementation Notes

## Design to files

- `src/index.ts` exports `createExpenseService(dependencies)` as required by the host API.
- `src/service.ts` contains the adapter orchestration, response mapping, and dependency contracts.
- `src/commands.ts` parses and validates incoming JSON commands.
- `src/expense.ts` defines the expense state union and pure workflow transitions.
- `src/expense-id.ts` and `src/employee-id.ts` define branded identifier types and parsers.
- `src/record.ts` validates and serializes the repository format.
- `src/result.ts` provides a small local Result type used by the parsers and orchestration helpers.
- `src/validation.ts` contains runtime checks for strings, email shape, and amount bounds.
- `src/service.test.ts` covers the workflow, validation, privacy, idempotency, and failure cases.

## Deviations from the frozen design

- The design proposed `zod` and `neverthrow`, but this workspace does not have runtime dependencies installed and the benchmark forbids editing `package.json`. I implemented the same boundary validation and explicit outcome handling locally instead of introducing unavailable libraries.
- The design suggested a versioned record envelope and branded schemas via a validation library. The record is still versioned, but branding uses `unique symbol` types rather than a schema brand feature.
- The design mentioned separate private wrappers for owner email. I kept email as an internal string field in the domain model and prevented disclosure by construction in response mapping and logging.

## Validation performed

- Ran `bun run typecheck`.
- Ran `bun test ./src`.

## Remaining limitations

- The implementation assumes the host repository stores JSON-compatible values and that logger calls do not fail in normal operation.
- Payment gateway failures are treated as unavailable responses, but the benchmark does not include retry orchestration or crash recovery.
- Repository compatibility is enforced only through the versioned record parser; older schemas are treated as invalid.

