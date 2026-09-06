# Expense Approval Service Design

## Scope

This project will provide a server-side TypeScript module exported from
`src/index.ts`:

```ts
createExpenseService(dependencies).handle(command)
```

There will be no UI, HTTP server, authentication provider, deployment code, or
concurrency/recovery machinery. The host already authenticates callers and
authorizes finance payment access; this module enforces only the workflow and
actor rules stated in `PRD.md` and `API.md`.

## Dependencies

Runtime dependency choice:

- `zod@4.1.5` for boundary validation and branded domain values.

Rationale:

- Commands and stored JSON are external inputs and must be validated at runtime.
- The supplied kamae defaults recommend Zod when no validation library is
  present.
- No Result library will be added. The workflow only needs a small local
  discriminated union such as `{ kind: "ok", value } | { kind: "err", error }`,
  which satisfies the current requirement without introducing another package.

## Architecture

The implementation will be split under `src/` into focused modules:

- `src/index.ts`: composition entry point and public `createExpenseService`
  export.
- `src/api/`: command schemas, response mapping, and dependency type definitions.
- `src/domain/`: expense value types, `Sensitive<T>`, state union, pure state
  transition functions, and operation-specific error unions.
- `src/storage/`: stored-record schema and mapping between stored JSON and domain
  values.
- `src/*.test.ts`: Bun tests for validation, workflow transitions, persistence,
  payment behavior, and privacy.

I will keep the module count proportional to this small API. Domain concepts that
carry invariants, such as `Expense`, `ExpenseId`, `EmployeeId`, `OwnerEmail`,
`AmountCents`, and `Sensitive`, will get their own files. Simple adapter response
helpers can stay together where they are only transport concerns.

## Domain Model

Expense state will be represented with a discriminated union using `kind`
internally:

- `DraftExpense`
- `SubmittedExpense`
- `ApprovedExpense`
- `RejectedExpense`
- `PaidExpense`

Each state will explicitly include the fields required in that state. For
example, reviewed states include `reviewerId`; rejected also includes `reason`;
paid includes `receiptId`.

The API response uses the required `state` strings:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `paid`

That transport `state` field will be derived from the internal `kind`. The owner
email will exist in the domain and stored record because payment needs it, but it
will never be included in API responses or diagnostic log events.

## Validation

Every command passed to `handle` will be parsed as `unknown` through Zod schemas.
Required fields will be checked before repository lookups, including for missing
expense IDs, so invalid commands return `400` instead of `404`.

Validation rules:

- IDs and actor/owner IDs: strings with at least one character.
- Email: syntactically valid according to Zod email validation.
- Description and rejection reason: strings containing non-whitespace text.
- Amount: integer from `1` through `1_000_000`.
- Receipt ID from the payment gateway: nonempty string.

Repository values returned by `repository.get(id)` will also be parsed. An
invalid stored record means storage is unusable for this request and will return
`500`, since the module cannot safely continue from corrupted or incompatible
JSON.

Owner email will be wrapped in a `Sensitive<T>` value after parsing. Its JSON,
string, and inspect representations will redact the contained value, while
payment code can explicitly unwrap it for the gateway call.

## Workflow

Create:

- Validate all fields.
- Check `repository.get(id)`.
- If present, return `409` and do not overwrite.
- Save a draft record.
- Log an event containing only non-PII fields such as `{ expenseId, action }`.
- Return `201`.

Submit:

- Validate `id` and `actorId`.
- Missing expense returns `404`.
- Only the owner can submit.
- Only drafts can be submitted.
- Save submitted state, log, return `200`.

Approve:

- Validate `id` and `actorId`.
- Missing expense returns `404`.
- Actor must differ from owner.
- Only submitted expenses can be approved.
- Save approved state with `reviewerId`, log, return `200`.

Reject:

- Validate `id`, `actorId`, and nonblank `reason`.
- Missing expense returns `404`.
- Actor must differ from owner.
- Only submitted expenses can be rejected.
- Save rejected state with `reviewerId` and `reason`, log, return `200`.
- Rejection is final because no transition will accept `RejectedExpense`.

Pay:

- Validate `id`.
- Missing expense returns `404`.
- Only approved expenses can be paid.
- Call `payment.charge` with the recorded amount, unwrapped owner email, expense
  ID, and the same expense ID as `idempotencyKey`.
- If declined, return `422` with `code: "payment_declined"` and do not save.
- If paid with a nonempty receipt ID, save paid state with `receiptId`, log,
  return `200`.
- If already paid, return the stored receipt without another gateway call,
  storage write, or log write.

Get:

- Validate `id`.
- Missing expense returns `404`.
- Return the current expense projection without owner email.

## Error Mapping

The adapter will return the exact required transport shape:

- `400` for invalid command shape or invalid required fields.
- `403` for unauthorized submit and self-review.
- `404` for missing expense.
- `409` for duplicate ID or an unavailable operation at the current state.
- `422` with `payment_declined` for gateway declines.
- `500` for rejected repository/payment promises, invalid stored JSON, and
  unusable payment responses.

Infrastructure exceptions will be caught only at the public `handle` boundary and
converted to `500`. Diagnostic logs will be attempted after successful state
changes only; log events will not include owner email.

## Storage Format

Stored records will be plain JSON with a version marker:

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

Using lower-case stored `kind` values keeps persisted JSON close to the public
state names while the mapped domain union can still use TypeScript-friendly
state-specific types. The mapper will be the only place that knows this storage
representation.

## Testing Plan

Tests will use in-memory fake repository, payment, and logger dependencies.
Coverage will include:

- Command validation for each operation, including required fields on missing
  IDs.
- Duplicate create preserving the original record.
- Full valid create -> submit -> approve -> pay flow.
- Unauthorized submit and self-review.
- Invalid state transitions such as paying drafts and reviewing paid expenses.
- Rejection requiring a reason and being final.
- Payment decline retry behavior.
- Paid repeat behavior with no extra gateway call or storage write.
- Repository and gateway failures returning `500`.
- Invalid stored JSON returning `500`.
- API responses and logs never exposing owner email.

## Assumptions

- Sequential request handling means no compare-and-swap or transaction protocol
  is required for duplicate create or state changes.
- The host restricts `pay` to finance users, so the command has no `actorId` and
  this module performs no finance authorization check.
- `logger.info` is synchronous as specified. If it throws despite the host
  contract, the public boundary will treat that as an unexpected `500`.
- Email syntax follows Zod's email validator rather than a custom RFC parser.
- Extra command fields are ignored after validation and never persisted.
