# Expense Approval Design

## Goal

Build a server-side TypeScript module that exports `createExpenseService(dependencies)` from `src/index.ts`. The service accepts JSON commands, applies the expense workflow from `PRD.md`, and returns `{ status, body }` responses as defined in `API.md`.

This design keeps the product as a pure domain workflow with thin boundary validation and explicit persistence/payment integration. There is no UI, HTTP server, auth system, or deployment concern in scope.

## Assumptions

These assumptions are recorded explicitly because the benchmark is unattended:

1. Commands arrive as raw JSON values and may be structurally invalid.
2. `ownerId`, `actorId`, and expense `id` are treated as nonempty strings.
3. The payment gateway is authoritative for payment success and provides a nonempty `receiptId` only when payment is successful.
4. Repository values are opaque JSON from the host and must be validated before use.
5. Requests are sequential, so the design does not add locking or optimistic concurrency controls.
6. The implementation may add runtime dependencies only through `package.json` `dependencies`.

## Library Choices

I would implement the module with:

1. `zod` for runtime boundary validation and branded identifiers.
2. `neverthrow` for explicit success/failure flow inside the application service.

These choices fit the Kamae guidance, keep external input parsing explicit, and make the operation outcomes easy to test. If the repository later contains a different established style, that style should win locally.

## Domain Model

### Core concepts

The domain revolves around one aggregate: `Expense`.

Domain state is modeled as a discriminated union using `kind` as the shared discriminant:

- `Draft`
- `Submitted`
- `Approved`
- `Rejected`
- `Paid`

Each state is a `Readonly<>` object. Shared fields are repeated per state rather than inherited from a base type so each variant remains self-contained and safe to narrow.

### Identifiers and private data

Expense IDs and employee IDs should be branded string types to prevent accidental mixing. The owner email is sensitive data and must never appear in responses or logs.

To keep that PII protected inside the service, I would model the stored owner email as a sensitive wrapper in the internal domain model and unwrap it only when sending the charge request or persisting repository JSON. The public response model never includes the field.

### Expense shape

The base fields are:

- `id`
- `ownerId`
- `ownerEmail`
- `description`
- `amountCents`

State-specific fields are:

- `reviewerId` for reviewed expenses
- `reason` for rejected expenses
- `receiptId` for paid expenses

The state itself carries the workflow meaning, so there is no separate status field.

### State transitions

All transitions are pure functions on the current state:

- `create` produces a `Draft`
- `submit` converts `Draft` to `Submitted`
- `approve` converts `Submitted` to `Approved`
- `reject` converts `Submitted` to `Rejected`
- `markPaid` converts `Approved` to `Paid`

Invalid transitions are not represented as exceptions inside the domain. They are surfaced as explicit operation outcomes in the use case layer so the adapter can map them to `409`, `403`, `404`, or `422` as required.

## Command Handling

The service should parse a top-level discriminated command union keyed by `op`:

- `create`
- `submit`
- `approve`
- `reject`
- `pay`
- `get`

Each command schema must require the fields listed in `API.md`, even if the expense does not exist. Missing fields or malformed fields are `400`.

Extra command fields can be ignored.

Parsing should happen before any repository or payment call. That prevents invalid submissions from being saved or paid.

## Persistence Design

### Repository contract

The host provides a single JSON repository with:

- `get(id)`
- `save(id, value)`

I would keep a repository adapter that validates stored values into an internal record shape and serializes the same shape back out.

### Stored format

The stored JSON should be versioned so the service can evolve safely. A single record envelope is enough:

- `schemaVersion`
- `kind`
- all state fields

This format preserves the complete expense lifecycle and is easy to validate on load. Because the host preserves repository values across service instances, the record needs to be self-describing.

### Read/write behavior

- `get` is used to retrieve the record and parse it into the domain model.
- `save` writes the current domain state back to the repository after a successful state change.
- If the repository returns malformed JSON or rejects, the service treats that as an unavailable storage failure and returns `500`.

## Workflow Design

### Create

1. Validate the command.
2. Check whether the ID already exists.
3. If it exists, return `409` and preserve the stored expense.
4. Otherwise create a `Draft`, save it, and log a diagnostic event.

### Submit

1. Validate the command.
2. Load the expense.
3. Return `404` if it is missing.
4. Return `403` if the caller is not the owner.
5. Return `409` if the expense is not a draft.
6. Transition to `Submitted`, save, and log the action.

### Approve

1. Validate the command.
2. Load the expense.
3. Return `404` if missing.
4. Return `403` if the reviewer is the owner.
5. Return `409` unless the expense is submitted.
6. Transition to `Approved` with the reviewer ID, save, and log the action.

### Reject

1. Validate the command.
2. Load the expense.
3. Return `404` if missing.
4. Return `403` if the reviewer is the owner.
5. Return `409` unless the expense is submitted.
6. Transition to `Rejected` with the reviewer ID and nonblank reason, save, and log the action.

### Pay

1. Validate the command.
2. Load the expense.
3. Return `404` if missing.
4. If the expense is already `Paid`, return the stored receipt immediately without calling the gateway or saving again.
5. Return `409` unless the expense is `Approved`.
6. Call the payment gateway with `expenseId`, `amountCents`, `email`, and `idempotencyKey` equal to the expense ID.
7. If the gateway declines, return `422` with `payment_declined`.
8. If the gateway rejects, returns an empty receipt, or returns an unusable payload, treat it as `500`.
9. On success, persist the `Paid` state with the receipt and log the action.

This ordering ensures a completed payment is persisted only after a nonempty receipt is confirmed, and repeated completed payments are served from storage without another gateway call.

## Error Mapping

The adapter should map outcomes to the API contract exactly:

- `400` for invalid commands or invalid fields
- `403` for unauthorized submit or self-review
- `404` for missing expenses
- `409` for duplicate IDs and workflow-stage conflicts
- `422` with code `payment_declined` for declined payment
- `500` for storage failure, gateway failure, or malformed gateway response

The service-level error model should remain narrower than the HTTP mapping. For example, `payment_declined` is a business outcome, while a rejected payment promise or unusable gateway response is an infrastructure failure.

## Logging

Only successful state changes should produce diagnostic events.

Every successful event should identify:

- the expense ID
- the action performed

The event must not include the owner email, raw charge payloads, or any other PII. The logger is only for operational tracing, not domain replay.

## Response Shape

Successful responses must include:

- `id`
- `ownerId`
- `description`
- `amountCents`
- `state`

Optional fields appear only when applicable:

- `reviewerId` after approval or rejection
- `reason` after rejection
- `receiptId` after payment

The owner email never appears in responses.

## File Structure

I would keep the implementation under `src/` with one concept per file:

- `src/index.ts` for the public factory
- `src/expense.ts` for the domain union and transition helpers
- `src/expense-id.ts` for the branded expense ID
- `src/employee-id.ts` for the branded employee ID
- `src/commands.ts` for command schemas and parsing
- `src/record.ts` for repository serialization and validation
- `src/service.ts` for orchestration and HTTP-style result mapping
- `src/*.test.ts` for behavior tests close to the code

This keeps the domain types separate from orchestration and adapter concerns.

## Testing Strategy

The tests should cover:

1. command validation and required-field enforcement
2. create conflict behavior
3. submit authorization and draft-only submission
4. approve/reject self-review blocking
5. rejection reason validation
6. payment decline, unavailable gateway, and unusable gateway response handling
7. paid-expense idempotency without repeat gateway calls
8. response redaction of owner email
9. logging only on successful changes
10. repository load failure and malformed stored record failure

## Summary

The design uses a small set of explicit domain states, validation at the boundary, pure state transitions, and narrow orchestration that maps domain outcomes to the host’s response contract. The main trade-off is a little repetition in the union types and record shape, but that buys predictable state handling, clear API mapping, and privacy-safe logging.
