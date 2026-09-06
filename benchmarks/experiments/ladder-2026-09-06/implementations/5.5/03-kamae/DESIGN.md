# Expense Approval Service Design

## Goal

Build a server-side TypeScript module exported from `src/index.ts`:

```ts
createExpenseService(dependencies).handle(command)
```

The module will validate host commands, enforce the expense workflow, persist expense JSON through the supplied repository, call the supplied payment gateway only when required, and return the transport shape defined in `API.md`. It will not provide UI, HTTP, auth, deployment, concurrency control, or crash recovery.

## Library Choices

- `zod@4.1.5` for runtime validation at external boundaries and branded domain values. Commands, stored records, and gateway responses are all untrusted JSON and will be parsed before use.
- `neverthrow@8.2.0` for expected business outcomes such as invalid state, duplicate ID, missing expense, unauthorized actor, and payment decline. Infrastructure rejections are caught only at the service adapter boundary because `API.md` requires a `500` response instead of a rejected `handle` promise.

These choices follow the Kamae preference order and keep the implementation dependency surface small.

## Module Structure

Planned files under `src/`:

- `src/index.ts`: composition root and public export.
- `src/service/expense-service.ts`: `handle(command)` adapter, command dispatch, response mapping, top-level infrastructure error boundary.
- `src/service/response.ts`: API response types and helpers.
- `src/domain/expense/expense.ts`: immutable discriminated union for expense states and pure transitions.
- `src/domain/expense/expense-id.ts`, `employee-id.ts`, `email-address.ts`, `description.ts`, `amount-cents.ts`, `rejection-reason.ts`, `receipt-id.ts`: branded value objects with companion schemas/parsers.
- `src/domain/expense/sensitive.ts`: closure-based PII wrapper for owner email.
- `src/domain/expense/expense-codec.ts`: stored JSON schema and mapping between persisted representation and domain model.
- `src/domain/expense/expense-resolver.ts`, `expense-store.ts`: domain-owned read/write contracts backed by the host repository adapter.
- `src/application/*.ts`: one use case per operation: create, submit, approve, reject, pay, get.
- `src/infrastructure/host-repository.ts`: adapter around `repository.get/save` that parses stored JSON and serializes domain values.
- `src/infrastructure/host-payment.ts`: adapter around `payment.charge` that validates gateway responses.
- `src/infrastructure/host-logger.ts`: narrow logger wrapper that emits PII-free diagnostic events.

Tests will live beside code under `src/`, using Bun's test runner.

## Domain Model

`Expense` will be a readonly discriminated union using `kind`:

- `DraftExpense`
- `SubmittedExpense`
- `ApprovedExpense`
- `RejectedExpense`
- `PaidExpense`

Each state stores the fields valid for that state. Shared fields will be repeated explicitly: `id`, `ownerId`, `ownerEmail`, `description`, and `amountCents`. Reviewed states add `reviewerId`; rejected adds `reason`; paid adds `receiptId`.

The API response uses `state` strings (`draft`, `submitted`, `approved`, `rejected`, `paid`) because `API.md` requires that transport format. The internal domain uses `kind` consistently and maps to `state` only at the response boundary.

Pure transition functions:

- `Expense.submit(draft, actorId)` produces `SubmittedExpense`.
- `Expense.approve(submitted, reviewerId)` produces `ApprovedExpense`.
- `Expense.reject(submitted, reviewerId, reason)` produces `RejectedExpense`.
- `Expense.markPaid(approved, receiptId)` produces `PaidExpense`.

Business rules that depend on the current state or actor return `Result` errors from use-case decision functions before any storage write or payment call.

## Boundary Validation

Every host command is parsed before dispatch. Required fields are validated even if the target ID later proves missing, so malformed commands return `400` before repository access.

Validation rules:

- IDs: nonempty strings after type validation. Whitespace-only IDs are invalid because they are effectively empty.
- Owner email: syntactically valid email, wrapped as `Sensitive<EmailAddress>` immediately after parsing.
- Description and rejection reason: contain non-whitespace text.
- Amount: integer from `1` through `1_000_000`.
- Gateway receipt: `{ kind: "paid", receiptId }` with nonempty receipt ID, or `{ kind: "declined" }`; anything else is an unusable gateway response and maps to `500`.
- Stored JSON: parsed on read. Missing returns `404`; malformed stored records are treated as unavailable storage and map to `500`.

Responses and logs will never include `ownerEmail`. Payment receives the unwrapped email only inside the payment adapter call.

## Operation Behavior

`create`:

- Validate all fields.
- Check repository for existing ID.
- If found, return `409`.
- Save a draft expense and log `{ expenseId, action: "created" }`.
- Return `201`.

`submit`:

- Validate `id` and `actorId`.
- Missing ID returns `404`.
- Only draft expenses can be submitted; other states return `409`.
- Non-owner submit returns `403`.
- Save submitted state and log `submitted`.

`approve`:

- Validate `id` and `actorId`.
- Missing ID returns `404`.
- Only submitted expenses can be approved; other states return `409`.
- Owner self-review returns `403`.
- Save approved state and log `approved`.

`reject`:

- Validate `id`, `actorId`, and nonblank `reason`.
- Missing ID returns `404`.
- Only submitted expenses can be rejected; other states return `409`.
- Owner self-review returns `403`.
- Save rejected state and log `rejected`.

`pay`:

- Validate `id`.
- Missing ID returns `404`.
- Draft, submitted, and rejected expenses return `409`.
- Paid expenses return the existing receipt with no gateway call, no storage write, and no log write.
- Approved expenses call payment with `expenseId`, `amountCents`, unwrapped owner email, and `idempotencyKey` equal to the expense ID.
- Declines return `422` with code `payment_declined` and do not save.
- Paid responses with empty receipt IDs or invalid shapes return `500` and do not save.
- Successful payment saves paid state, retains receipt ID, logs `paid`, and returns `200`.

`get`:

- Validate `id`.
- Missing ID returns `404`.
- Return the expense in API response format at any stage.

## Error Mapping

Expected use-case errors map to API responses:

- validation failure: `400 { code: "invalid_command" }`
- unauthorized submit or self-review: `403 { code: "forbidden" }`
- missing expense: `404 { code: "not_found" }`
- duplicate or invalid workflow stage: `409 { code: "conflict" }`
- payment declined: `422 { code: "payment_declined" }`

Repository rejections, payment rejections, invalid stored records, and invalid gateway paid responses map to `500 { code: "service_unavailable" }`.

## Diagnostics

The logger receives only structured events with:

- `expenseId`
- `action`

No event includes owner email, raw command bodies, stored records, payment payloads, or validation issue details that might echo PII. Logging is best-effort only if the host logger throws is unspecified; the design will treat logger exceptions as infrastructure failure and return `500` to avoid claiming success when diagnostics cannot be written.

## Testing Plan

Focused Bun tests under `src/`:

- Command validation rejects malformed or missing required fields without writes or payment calls.
- Create saves valid drafts, rejects duplicate IDs, and omits email from responses.
- Submit enforces owner-only draft submission.
- Review enforces submitted-only state, non-owner reviewer, reviewer recording, and final rejection reason.
- Pay enforces approved-only payment, decline retry behavior, receipt retention, idempotent paid repeat behavior, and gateway/storage failure mapping.
- Get retrieves every state and omits email.
- PII tests confirm response bodies and logger events never contain owner email.
- Stored record parsing failures return `500`.

## Assumptions

- Requests are sequential as stated, so check-then-save for duplicate IDs is acceptable.
- Repository values are JSON-compatible and may have been produced by an older service instance, so reads are always validated.
- Whitespace-only IDs are considered invalid nonempty-string inputs.
- Extra command fields are ignored after validation.
- Logger failures should fail the operation with `500`, because successful changes are required to leave a diagnostic event.
- There is no edit operation; create-time values remain immutable except for workflow-specific review and payment fields.
