# Implementation Map

## Design To Files

- `src/index.ts`
  - Exports `createExpenseService` and the public service types.
- `src/service.ts`
  - Implements command dispatch, repository orchestration, payment handling, logging, and API response mapping.
- `src/command.ts`
  - Validates and parses inbound command objects.
- `src/expense.ts`
  - Defines the expense state union, state transitions, storage reconstruction, and response-body projection.
- `src/expense-service.test.ts`
  - Exercises the full command surface and the failure/privacy cases required by the PRD and API.

## Deviations From The Frozen Design

- The frozen design proposed `zod` and `neverthrow`, but neither library is present in the installed dependencies. I kept the implementation self-contained with small runtime validators and explicit success/failure unions.
- I kept the storage format as a self-describing JSON expense record with `kind` plus the invariant fields and state-specific fields. This matches the design intent while staying minimal.

## Validation Performed

- Ran `bun run typecheck`
- Ran `bun test ./src`

## Remaining Limitations

- The module assumes sequential request handling, as required by the PRD.
- Repository corruption or unusable stored data is treated as a 500-class failure.
- Email validation is syntactic and conservative; it is intended to catch malformed input, not fully implement RFC email parsing.
- Logger failures are not specially recovered from; the host contract does not define them as a separate recoverable class.
