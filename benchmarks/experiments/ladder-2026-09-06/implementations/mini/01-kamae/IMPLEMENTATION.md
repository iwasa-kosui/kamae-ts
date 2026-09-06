# Implementation Summary

## Assumptions

- The workspace does not include a validation library or Result library, so I implemented local runtime parsers and a small internal `Result` type instead of adding dependencies.
- Sequential request handling means I did not add locking, retries, or crash-recovery logic.
- Diagnostic logging is best-effort after successful state changes; logger failures do not change the returned workflow result.

## Design To Files

| Design area | Files |
| --- | --- |
| Host adapter entry point | [`src/index.ts`](./src/index.ts) |
| Service orchestration and status mapping | [`src/service.ts`](./src/service.ts) |
| Command boundary parsing | [`src/command.ts`](./src/command.ts) |
| Expense state model, transitions, response shaping, log events | [`src/expense.ts`](./src/expense.ts) |
| Expense id value object | [`src/expense-id.ts`](./src/expense-id.ts) |
| Employee id value object | [`src/employee-id.ts`](./src/employee-id.ts) |
| Email value object | [`src/email-address.ts`](./src/email-address.ts) |
| Description value object | [`src/expense-description.ts`](./src/expense-description.ts) |
| Amount value object | [`src/amount-cents.ts`](./src/amount-cents.ts) |
| Local result helper | [`src/result.ts`](./src/result.ts) |
| Runtime validation helpers | [`src/validation.ts`](./src/validation.ts) |
| Local branding helper | [`src/brand.ts`](./src/brand.ts) |
| Workflow tests | [`src/service.test.ts`](./src/service.test.ts) |

## Deviations From DESIGN.md

- I did not use a third-party validation library because none was installed in the workspace.
- I did not create the exact file split listed in the design for every conceptual helper; shared utility files were added for local `Result`, validation, and branding support.
- The logger is treated as best-effort. If `logger.info()` throws, the service still returns the workflow result.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

Both commands passed after the implementation was completed.

## Remaining Limitations

- Storage and gateway failures are surfaced as `500` responses, but there is no retry or recovery path beyond that because the PRD explicitly excludes recovery after process crashes.
- Command and storage validation uses hand-written parsers rather than schema objects from a validation library.
- The service currently assumes the host passes JSON-compatible objects to `handle()`, matching the API contract.
