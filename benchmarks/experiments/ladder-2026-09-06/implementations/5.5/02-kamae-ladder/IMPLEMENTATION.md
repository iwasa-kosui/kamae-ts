# Implementation

## File Mapping

- `src/index.ts` exports `createExpenseService(dependencies)` and routes parsed commands to operation handlers.
- `src/api/commands.ts` defines the Zod command schemas for `create`, `submit`, `approve`, `reject`, `pay`, and `get`.
- `src/api/dependencies.ts` defines the host dependency and JSON value contracts.
- `src/api/response.ts` defines the required `{ status, body }` response shape.
- `src/domain/expense.ts` defines the expense state union, pure transitions, and public response projection.
- `src/domain/*` value files define branded IDs, email, description, amount, rejection reason, receipt ID, and `Sensitive<T>`.
- `src/storage/stored-expense.ts` validates stored JSON and maps between storage records and domain expenses.
- `src/expense-service.test.ts` contains integration-style Bun tests around the public adapter.

## Design Application

Commands and stored records are validated with Zod at the API and storage boundaries. Domain states use a `kind` discriminant, and transitions create new immutable objects rather than mutating existing records. Owner email is wrapped as `Sensitive<OwnerEmail>` in domain code, unwrapped only for storage and the payment gateway, and omitted from response and log projections.

The stored format follows the design:

```ts
{
  schemaVersion: 1,
  kind: "draft" | "submitted" | "approved" | "rejected" | "paid",
  id,
  ownerId,
  ownerEmail,
  description,
  amountCents,
  reviewerId?,
  reason?,
  receiptId?
}
```

## Deviations

- I did not keep a local generic `Result` helper. The final operation code only needs small direct transition error unions, so the extra abstraction did not carry a concrete invariant.
- I kept host dependency contracts in `src/api/dependencies.ts` because they describe the supplied adapter boundary. Domain-specific behavior remains in `src/domain/expense.ts`.

## Assumptions

- Commands include an `op` field matching the operation names in `API.md`.
- The host authorizes finance access before calling `pay`, so this module does not require a payment actor field.
- Repository data with the expected ID but invalid stored shape is treated as unusable storage for that request and returns `500`.
- `logger.info` is expected to be synchronous. If it throws, the public handler returns `500`.
- Email validity follows Zod's email validator.

## Validation Performed

- `bun run typecheck`
- `bun test ./src`

The tests cover validation, duplicate create preservation, submit/review authorization, invalid transitions, rejection finality, payment decline retry behavior, idempotent completed payment, storage and gateway failures, invalid stored JSON, and email privacy in responses/logs.

## Remaining Limitations

- No concurrency control or crash recovery is implemented, matching the PRD scope.
- If logging fails after a successful repository save, the response is `500` even though the state change may already be persisted.
