# Expense Approval Design

## Goals

Build a server-side TypeScript module that:

- validates incoming commands at the boundary
- models the expense lifecycle as a strict state machine
- preserves ownership and review rules
- integrates with the host repository, payment gateway, and logger
- never exposes the owner email in responses or diagnostic events

The implementation will live under `src/` and export `createExpenseService(dependencies)` from `src/index.ts` as required by `API.md`.

## Assumptions

These assumptions are made explicitly because the benchmark is unattended:

1. Commands arrive as JSON objects with an `op` discriminator and the required fields listed in `API.md`.
2. Requests are sequential, so I do not need locks, retries, or crash recovery logic.
3. The host repository stores opaque JSON values, so the service may persist its own expense shape directly.
4. I will add `zod` as the runtime validation library for boundary parsing.
5. I will not add a third-party Result library; the workflow layer will use small local discriminated unions for expected failures.

## Proposed Architecture

The service will have four layers:

1. Boundary parsing and validation
2. Domain state and transition rules
3. Use-case orchestration
4. Host adapter mapping

The layers stay narrow:

- boundary code turns `unknown` into validated command values
- domain code decides whether a transition is legal
- orchestration reads from storage, applies a transition, persists the result, and emits logs
- the adapter maps domain/use-case outcomes to the `{ status, body }` transport contract

## Domain Model

The central aggregate is `Expense`, represented as a discriminated union with `kind` as the state field.

Proposed states:

- `Draft`
- `Submitted`
- `Approved`
- `Rejected`
- `Paid`

Each state will contain the fields required at that stage. Shared values such as `id`, `ownerId`, `ownerEmail`, `description`, and `amountCents` will be duplicated across the state variants rather than inherited from a base type. That keeps each state self-contained and avoids optional fields.

State-specific fields:

- `Submitted` keeps the original expense data and indicates submission
- `Approved` adds `reviewerId`
- `Rejected` adds `reviewerId` and `reason`
- `Paid` adds `reviewerId` and `receiptId`

The `Expense` companion object will own pure transition helpers such as:

- `create(...)`
- `submit(draft, actorId)`
- `approve(submitted, actorId)`
- `reject(submitted, actorId, reason)`
- `markPaid(approved, receiptId)`

These helpers will never call storage, payment, or logging. They only transform one valid state into the next valid state.

## Boundary Validation

All external commands will be parsed with `zod` before any workflow logic runs.

Validation rules:

- `id` and actor identifiers must be nonempty strings
- `ownerEmail` must be syntactically valid
- `description` must contain non-whitespace text
- `amountCents` must be an integer in the range `1..1_000_000`
- `reason` must be nonblank when present for rejection
- required fields must be present even if the expense does not exist

The parser will reject invalid commands before storage lookup, which ensures invalid data is never saved or paid.

I will keep the boundary schemas and the derived command types together so the schema remains the source of truth.

## Workflow Design

Each command will follow the same orchestration pattern:

1. Parse and validate the raw command.
2. Load the expense if the command operates on an existing ID.
3. Enforce stage and ownership rules.
4. Apply the pure domain transition.
5. Save the new state when required.
6. Emit a diagnostic event that identifies the expense and action only.
7. Return a transport response with the correct status code and body.

### Create

- validate the command fields
- if the `id` already exists, return `409`
- otherwise create a `Draft`
- persist it
- log a `created` event containing only the expense ID and action

### Submit

- validate `id` and `actorId`
- missing expense returns `404`
- only the owner may submit, otherwise `403`
- drafts become `Submitted`
- any non-draft stage returns `409`
- log a `submitted` event

### Approve

- validate `id` and `actorId`
- missing expense returns `404`
- the reviewer must not be the owner, otherwise `403`
- only `Submitted` expenses can be approved
- `Approved` records the `reviewerId`
- log an `approved` event

### Reject

- validate `id`, `actorId`, and `reason`
- missing expense returns `404`
- the reviewer must not be the owner, otherwise `403`
- only `Submitted` expenses can be rejected
- rejection is final and records `reviewerId` plus `reason`
- log a `rejected` event

### Pay

- validate `id`
- missing expense returns `404`
- only `Approved` expenses can be paid
- if the expense is already `Paid`, return the stored receipt without calling the gateway or writing storage
- call the payment gateway with:
  - `expenseId` as the idempotency key
  - the stored amount
  - the stored owner email
- if the gateway declines, return `422` with code `payment_declined`
- if the gateway is unavailable, storage fails, or the gateway returns an unusable response, return `500`
- only save the paid state when the gateway returns a nonempty receipt ID
- log a `paid` event after a successful state change

## Error Mapping

Expected workflow failures will be modeled explicitly rather than thrown.

Planned failure categories:

- `invalid_command` -> `400`
- `forbidden` -> `403`
- `missing_expense` -> `404`
- `conflict` -> `409`
- `payment_declined` -> `422`
- `unavailable` -> `500`

The adapter will translate these internal outcomes into `{ status, body: { code } }`.

Unexpected infrastructure faults, such as rejected repository or payment promises, will propagate to the application boundary and become `500` responses.

## Privacy Design

The owner email is required internally for storage and payment, but it must never appear in:

- response bodies
- logger events
- diagnostic codes

To enforce that:

- command parsing will accept the email
- the expense state will persist the email only as internal data
- logger events will include only the expense ID and action
- response mapping will project only the public fields required by `API.md`

I will not use the email in any string formatting or error message that could leak it.

## Persistence Format

The simplest and safest storage choice is to persist the expense union directly as JSON.

Benefits:

- no translation layer between storage and domain state
- the saved record already contains the full workflow state
- repeated service instances can reload the exact same state

The repository interface is small enough that a dedicated repository abstraction is unnecessary. The use case only needs one read and one write operation for the expense aggregate.

## File Layout

Proposed `src/` structure:

- `src/index.ts` - exported service factory and command dispatcher
- `src/expense.ts` - domain state union and transition helpers
- `src/expense-id.ts` - ID parsing and branding
- `src/expense-command.ts` - command schemas and command types
- `src/expense-result.ts` - local workflow result unions and status mapping
- `src/expense-service.ts` - orchestration logic
- `src/public-expense.ts` - response projection that omits the email
- `src/logger-event.ts` - diagnostic event shapes
- `src/test-utils.ts` - shared fixtures for tests

If this layout changes during implementation, the same principles should remain:

- one concept per file
- pure domain transitions separate from I/O
- adapters at the boundary only

## Testing Strategy

Tests should cover the state machine and host-facing behavior.

Planned test groups:

- command validation rejects malformed input and never touches storage
- create, submit, approve, reject, and pay follow the correct lifecycle
- unauthorized submit and self-review return `403`
- missing expenses return `404`
- invalid stage transitions return `409`
- payment decline returns `422`
- successful payment stores the receipt and is idempotent on repeat calls
- repeated payment of an already paid expense returns the same receipt without a gateway call
- owner email never appears in response bodies or log events

## Why This Design

This design keeps the system small but strict.

- discriminated unions make illegal states explicit
- validation at the boundary prevents bad data from entering the workflow
- pure transition helpers keep business rules testable without mocks
- direct JSON persistence minimizes adapter complexity
- the privacy rule is enforced by projection, not by convention

That balance is appropriate for a single-aggregate service with a narrow host contract.
