# Expense Approval Service Implementation

## File Mapping

- `src/index.ts` exports `createExpenseService(dependencies)` and adapts the host repository, payment gateway, and logger to domain-facing contracts.
- `src/api/command.ts` validates all incoming commands with Zod, including required fields before any repository lookup.
- `src/api/handle-command.ts` dispatches commands to use cases and maps expected outcomes to the API status/code contract.
- `src/api/response.ts` builds success and error responses and excludes `ownerEmail`.
- `src/domain/*.ts` contains branded value objects, the `Sensitive<T>` wrapper, expense state unions, pure state transitions, and domain-owned dependency contracts.
- `src/storage/stored-expense.ts` defines the versioned JSON storage schema.
- `src/storage/expense-record-mapper.ts` maps between stored JSON and domain expenses, treating invalid stored data as unusable.
- `src/use-cases/*.ts` implements create, submit, approve, reject, pay, and get workflows.
- `src/expense-service.test.ts` contains Bun tests for the required behavior.

## Deviations From DESIGN.md

- `src/support/schema-result.ts` uses direct Zod `safeParse` instead of the Standard Schema helper shown in the design. The declared dependency set includes Zod directly but not `@standard-schema/spec`, so this keeps the implementation within supplied dependencies.
- The response and adapter types are compact rather than split into additional small files beyond the design list. The domain/storage/use-case boundaries remain as designed.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

Both commands pass.

## Assumptions

- Employee IDs and expense IDs are nonempty strings with no additional format.
- Zod's `z.email()` is the syntactic email validator.
- Sequential repository replacement is sufficient for this version.
- Logger failures are treated as unexpected service failures by the `handle` boundary.

## Remaining Limitations

- No concurrency protection or crash recovery is implemented, matching the PRD scope.
- Invalid stored records return `500` because the service cannot safely continue from corrupted persisted data.
