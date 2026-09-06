# Implementation

## Mapping

- `src/index.ts` exports `createExpenseService(dependencies)` and owns command orchestration, response status/code mapping, dependency failure handling, payment calls, and non-PII logging.
- `src/domain/expense.ts` contains the expense discriminated union, pure transitions, the response projection, and the closure-backed `Sensitive<T>` wrapper for owner email.
- `src/application/validation.ts` parses untrusted commands and repository JSON, and maps domain expenses back to the stored JSON shape.
- `src/index.test.ts` exercises the public adapter with in-memory repository, payment, and logger fakes.

## Deviations

- The frozen design listed one file per tiny value object. I collapsed ID, email, money, result, response, and storage helpers into the three implementation files above because there were no existing local patterns and LADDER favors the smallest structure that fully preserves the required invariants.
- No validation or result library was introduced. `package.json` has no such dependency, the user prohibited dependency changes, and the design selected direct validators plus a small local parse-result union.
- Employee IDs and expense IDs are plain strings after boundary validation rather than branded types. Without a validation library, brands would add local assertions and file count without improving runtime behavior for this benchmark.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

## Assumptions

- Practical email syntax validation is sufficient; DNS and deliverability checks are out of scope.
- The host authorizes finance callers before `pay`, so the pay command has no actor field.
- Repository data can be malformed despite being host-preserved JSON; malformed stored records return `500 invalid_dependency_response`.
- Diagnostic events intentionally include only `{ expenseId, action }`.

## Remaining Limitations

- Requests are sequential as specified; no locking or compare-and-swap behavior is implemented.
- If logging throws after a successful save, the application boundary returns `500 service_unavailable` even though the state change may already have been persisted.
