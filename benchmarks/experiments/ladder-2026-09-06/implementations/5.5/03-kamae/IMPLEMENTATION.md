# Implementation Notes

## Design Mapping

- `src/index.ts` exports `createExpenseService(dependencies)` and composes host adapters with the service adapter.
- `src/service/expense-service.ts` owns command dispatch, status-code mapping, and the top-level infrastructure error boundary.
- `src/service/command.ts` validates every host command with Zod before any repository or payment access.
- `src/service/response.ts` maps domain expenses to API response bodies and omits `ownerEmail`.
- `src/domain/expense/*.ts` implements branded value objects, the `Sensitive<T>` PII wrapper, the expense discriminated union, pure state transitions, repository-facing contracts, and the stored JSON codec.
- `src/application/*.ts` implements one use case per operation: create, submit, approve, reject, pay, and get.
- `src/infrastructure/host-repository.ts` adapts host storage and validates stored JSON on read.
- `src/infrastructure/host-payment.ts` adapts the gateway and rejects unusable gateway responses, including empty receipt IDs.
- `src/infrastructure/host-logger.ts` emits PII-free diagnostic events.
- `src/expense-service.test.ts` tests the public adapter through the exported factory.

## Requirements Coverage

- R1: `create` validates ID, owner ID, email, description, and amount; duplicate IDs return `409` without replacing the original.
- R2: new expenses are saved as drafts; `submit` requires the owner and no edit operation exists.
- R3: `approve` and `reject` require submitted expenses, require a different reviewer, record `reviewerId`, and make rejection final with a nonblank reason.
- R4: `pay` only pays approved expenses, charges the recorded amount and email, uses the expense ID as idempotency key, saves nonempty receipts, and returns paid expenses idempotently without another gateway call or write.
- R5: declined payments return `422 { code: "payment_declined" }` without saving paid state; gateway/storage failures and unusable gateway responses return `500`.
- R6: `get` retrieves every stage; malformed commands return `400` before repository access; missing expenses return `404`; invalid workflow operations return `409`.
- R7: responses and logger events never include owner email; email is wrapped as `Sensitive<T>` inside the domain and unwrapped only for storage serialization and payment.

## Deviations

- The planned `expense-resolver.ts` name is implemented as `expense-by-id-resolver.ts` to make the single read contract explicit.
- Expected workflow errors are modeled with small use-case-specific `Result` unions. Infrastructure failures are left as thrown/rejected faults and converted to `500` in `src/service/expense-service.ts`, as designed.

## Assumptions

- Whitespace-only IDs, descriptions, and rejection reasons are invalid.
- Extra command fields are ignored by the Zod object schemas.
- Logger failures are treated as infrastructure failures and return `500`.
- Sequential request handling makes the create-time check-then-save duplicate check sufficient for this version.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

## Remaining Limitations

- There is no concurrency control or crash recovery, matching the PRD scope.
- There is no authenticated finance check in `pay`; the host is responsible for finance authorization as specified.

