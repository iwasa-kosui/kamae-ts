# Implementation: Employee Expense Approval

## File Mapping

- `src/index.ts` exports `createExpenseService(dependencies)` and the host-facing `handle(command)` adapter.
- `src/api/commands.ts` validates all incoming commands with Zod before any lookup or workflow action.
- `src/api/dependencies.ts` defines the host repository, payment, logger, and service dependency types.
- `src/api/adapters.ts` adapts host dependencies into narrow domain contracts, validates stored JSON on read, validates payment responses, and builds the gateway request with the expense ID as the idempotency key.
- `src/api/storage-expense.ts` defines the persisted JSON format `{ version: 1, kind, ... }` and maps between storage values and domain expenses.
- `src/api/responses.ts` maps domain expenses to public response bodies and omits `ownerEmail`.
- `src/api/handle.ts` is the application boundary: it dispatches use cases, maps expected errors to API statuses, and maps unexpected storage/gateway/unusable-value failures to `500`.
- `src/domain/expense/*.ts` defines branded primitives, the immutable expense state union, pure transitions, and narrow resolver/store/payment/logger contracts.
- `src/application/*.ts` implements create, get, submit, approve, reject, and pay workflows.
- `src/shared/*.ts` contains `Sensitive<T>`, validation-to-Result conversion, and exhaustiveness checking.
- `src/index.test.ts` exercises the exported adapter through the host contract.

## Assumptions

- `pay` callers are authorized finance users because the host owns finance authorization.
- Employee IDs and actor IDs use the same nonempty-string validation as other IDs.
- Invalid persisted JSON means storage is unusable for this module and returns `500`.
- Logger events are allowlisted diagnostic objects; dependency errors and raw command/storage/payment values are not logged.

## Deviations From DESIGN.md

- The design proposed separate `src/api/` files for response mapping, adapters, and the handle boundary; this implementation follows that, but keeps each use case in one focused file rather than adding extra helper layers.
- The shared validation helper uses Zod `safeParse` directly instead of the Standard Schema factory, because Zod is the selected installed validation library and no cross-library support is needed in this benchmark.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

Both commands pass.

## Remaining Limitations

- The module follows the PRD's sequential-request assumption and does not implement compare-and-swap, locking, or crash recovery.
- There is no edit workflow for draft expenses, as requested.
- If a logger throws after persistence, the boundary returns `500`; the host logger contract says it returns nothing, so this is treated as an unexpected infrastructure fault.
