# Implementation Notes

## Design mapping

- `src/index.ts` exports `createExpenseService(dependencies)` and owns host
  response mapping, dependency adaptation, logging, and the `500` boundary for
  storage, payment, logger, malformed storage, and malformed gateway failures.
- `src/domain/value-objects.ts` defines Zod-branded IDs, amount, email,
  description, rejection reason, and the `Sensitive` owner-email wrapper.
- `src/domain/expense.ts` defines the immutable expense state union, pure
  transitions, and public response projection without owner email.
- `src/domain/expense-resolver.ts` and `src/domain/expense-store.ts` define the
  narrow read/write contracts used by application workflows.
- `src/application/commands.ts` validates all incoming command shapes before any
  repository lookup.
- `src/application/use-cases.ts` implements create, get, submit, approve, reject,
  and pay workflows with expected business outcomes represented as
  `neverthrow` results.
- `src/infrastructure/storage-codec.ts` validates repository records and maps
  between stored JSON and domain values.
- `src/infrastructure/payment-codec.ts` validates gateway responses before a
  paid state can be saved.
- `src/expense-service.test.ts` contains the Bun tests for validation,
  workflow restrictions, payment behavior, dependency failures, and privacy.

## Deviations and material choices

- Public response bodies use plain JSON primitives (`string` and `number`)
  rather than branded domain types. The domain keeps branded values internally;
  the host transport contract receives JSON-shaped values.
- Storage uses internal `kind` values (`Draft`, `Submitted`, etc.) and responses
  use API `state` values (`draft`, `submitted`, etc.), matching the design.
- Infrastructure rejections are not put into use-case result unions. They
  propagate to the adapter boundary and are returned as `500`, as the product
  defines no recovery decision other than reporting unavailability.

## Assumptions

- Command operation is supplied as `op`.
- Nonempty IDs are valid without trimming; descriptions and rejection reasons
  must contain non-whitespace text.
- Zod's `email()` check is sufficient for syntactic email validation.
- `logger.info` is synchronous. If it throws, the adapter returns `500`.
- Malformed stored records are treated as unusable storage for that request and
  returned as `500`.

## Validation performed

- `bun run typecheck`
- `bun test ./src`

Both commands pass.

## Remaining limitations

- Requests are handled according to the stated sequential-request scope; no
  concurrency control or crash recovery was added.
- There is no edit workflow, authentication, authorization provider, UI, HTTP
  server, deployment code, or external persistence adapter beyond the supplied
  host dependency contract.
