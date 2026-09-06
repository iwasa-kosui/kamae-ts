# Expense Approval Design

## Summary

Build a small server-side TypeScript module that exposes `createExpenseService(dependencies)` from `src/index.ts` and keeps the business rules in a domain-first shape. The implementation will be split into:

- a validated command boundary
- a pure expense state model
- a workflow service that orchestrates repository, payment, and logging
- tests that exercise the full command surface

The design follows the repository's constraints: sequential requests only, no UI or HTTP server, no crash-recovery work, and no edits to the supplied PRD/API/LADDER files.

## Library Choices

I will add two runtime dependencies:

- `zod` for runtime schemas at the command boundary
- `neverthrow` for explicit success/failure handling in workflow code

This is the smallest combination that cleanly satisfies the boundary-validation and error-modeling guidance without introducing extra abstractions.

## Domain Model

The central aggregate is `Expense`, modeled as a discriminated union with `kind` as the state field:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `paid`

Every state carries the invariant fields:

- `id`
- `ownerId`
- `description`
- `amountCents`

State-specific fields are explicit:

- `submitted` records `submittedBy`
- `approved` records `reviewerId`
- `rejected` records `reviewerId` and `reason`
- `paid` records `receiptId`

The owner email is treated as private data. It is part of the stored expense record and the payment request, but it is never included in service responses or logger payloads.

## File Shape

The code under `src/` will be organized by concept rather than by technical layer.

Planned files:

- `src/index.ts` exports the service factory
- `src/service.ts` orchestrates command handling
- `src/expense.ts` defines the expense union and transitions
- `src/expense-id.ts` defines the branded expense id
- `src/employee-id.ts` defines the branded employee id
- `src/command.ts` validates incoming commands
- `src/result.ts` defines internal success/failure helpers if needed
- `src/response.ts` maps domain outcomes to `{ status, body }`
- `src/tests/*.test.ts` covers the behavior

This keeps each concept isolated and avoids a catch-all models file.

## Validation Strategy

All external input is parsed with `zod` before it reaches the domain.

Validation rules:

- `id` must be a nonempty string
- `ownerId` and `actorId` must be nonempty strings
- `ownerEmail` must be syntactically valid
- `description` must contain non-whitespace text
- `amountCents` must be an integer from `1` to `1_000_000`
- `reason`, when required, must contain non-whitespace text

The command parser will:

- require the fields listed in `API.md`
- ignore extra fields
- reject malformed shapes before any repository or payment call

I will derive TypeScript types from the schemas instead of restating the same shape in separate interfaces.

## Workflow Design

`handle(command)` will follow this flow:

1. Validate the command shape.
2. Load the current expense when the command targets an existing record.
3. Apply the command-specific rule.
4. Persist the new state if the step is allowed.
5. Call payment only for `pay`.
6. Emit a diagnostic event only after successful state changes.

The service will not attempt retries, optimistic concurrency, or partial recovery because the PRD says requests are sequential and crash recovery is out of scope.

### Command handling

- `create`
  - Reject duplicate IDs with `409`
  - Persist a new `draft` expense on success
  - Return `201`
- `submit`
  - Require the expense to exist
  - Allow only the owner to submit
  - Move `draft` to `submitted`
- `approve`
  - Require a submitted expense
  - Reject self-review
  - Move `submitted` to `approved`
- `reject`
  - Same review rules as approve
  - Require a nonblank `reason`
  - Move `submitted` to `rejected`
- `pay`
  - Require an `approved` expense
  - Call the payment gateway with:
    - `expenseId`
    - `amountCents`
    - `email`
    - `idempotencyKey = expenseId`
  - On payment success, store `receiptId` and return `paid`
  - On decline, return `422` with `payment_declined`
  - On storage or gateway unavailability, return `500`
- `get`
  - Return the current expense state at any stage
  - Include `404` for missing IDs

## Persistence Shape

The repository stores a JSON record that preserves enough information to reconstruct the exact expense state later.

Stored fields:

- `kind`
- `id`
- `ownerId`
- `ownerEmail`
- `description`
- `amountCents`
- state-specific fields like `submittedBy`, `reviewerId`, `reason`, `receiptId`

The stored shape is an implementation detail. Response bodies will be mapped from this internal representation and will deliberately exclude `ownerEmail`.

Because the host preserves repository JSON across service instances, this storage shape must be stable and self-describing.

## Error Mapping

The service will distinguish:

- invalid command or invalid field data -> `400`
- unauthorized submit or self-review -> `403`
- missing expense -> `404`
- duplicate ID or stage violation -> `409`
- declined payment -> `422`
- unavailable storage/gateway or unusable gateway response -> `500`

The only mandatory error code string from the API is `payment_declined`. Other code strings will be chosen to be descriptive and stable, but they will not leak email addresses or other private data.

## Logging

Successful state changes will emit a diagnostic event with:

- expense id
- action name

No logger payload will include `ownerEmail`.

Log events are best-effort diagnostics, not part of the user-visible result contract.

## Testing Plan

Tests will live under `src/` and use Bun's test runner.

Coverage will include:

- valid create / submit / approve / reject / pay / get flows
- duplicate create
- owner-only submit
- self-review rejection
- rejection reason validation
- stage conflicts
- payment decline
- gateway or repository failure
- privacy checks for response bodies and logged events
- required-field validation even when the expense does not exist

## Assumptions

- Sequential request handling means I do not need locking or conflict retries.
- The host-provided repository and payment gateway are the only persistence and side-effect mechanisms.
- `ownerEmail` may be stored internally but must never be exposed in responses or logs.
- The host owns authentication and finance authorization; the service only applies business rules.
- Extra command fields can be ignored.

