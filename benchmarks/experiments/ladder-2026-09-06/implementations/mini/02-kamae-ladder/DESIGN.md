# Expense Approval Design

## Goals

Build a server-side TypeScript module that exposes `createExpenseService(dependencies)` from `src/index.ts` and implements the six commands in `API.md` against the workflow in `PRD.md`.

The design follows the supplied decision order:

1. Reuse the host-provided repository, payment gateway, and logger contracts.
2. Use standard TypeScript and runtime validation where it protects boundary inputs.
3. Keep the domain model small and state-driven.
4. Add only the minimum custom code required for the current workflow.

## Assumptions

- Requests are sequential, so there is no need for locking, retries, or crash recovery logic.
- The host already authenticates callers and authorizes finance to pay.
- Unknown command fields may be ignored.
- The owner email must be stored internally because the payment gateway needs it, but it must never appear in responses or diagnostic logs.
- Email validation only needs to be syntactically valid for this product, not a full RFC edge-case implementation.

## Proposed Runtime Dependencies

- Add `zod` for runtime boundary validation.
- Do not add a Result library.

Reasoning: the public API already returns `{ status, body }`, so a generic Result abstraction would be extra layering without a real payoff here. The code can keep domain outcomes explicit with small tagged unions and direct control flow.

## Module Structure

Keep the implementation in a small set of focused files under `src/`:

- `src/index.ts` - public factory and command dispatcher.
- `src/domain/expense.ts` - expense state, transitions, and response shaping.
- `src/domain/command.ts` - command schemas and parsed command types.
- `src/domain/errors.ts` - status/code mapping helpers for expected failures.
- `src/domain/response.ts` - conversion from internal expense state to host response bodies.
- `src/test/*.test.ts` - behavior tests for transitions, validation, privacy, and payment idempotency.

Each file should own one concept. The domain state should remain free of host transport details.

## Domain Model

Represent an expense as a discriminated union keyed by `state`.

Internal record shape:

- `id`
- `ownerId`
- `ownerEmail`
- `description`
- `amountCents`
- `state`: `draft | submitted | approved | rejected | paid`
- `reviewerId?`
- `reason?`
- `receiptId?`

The internal record is the source of truth for storage. The response body is derived from it and must omit `ownerEmail`.

State semantics:

- `draft` - created but not yet submitted.
- `submitted` - owner submitted, waiting for review.
- `approved` - reviewed positively, waiting for payment.
- `rejected` - reviewed negatively, terminal.
- `paid` - paid successfully, terminal.

## Validation Strategy

Validate all external inputs at the boundary before touching storage or payment:

- command object shape
- required fields for the specific operation
- ID is a nonempty string
- email is syntactically valid
- description contains non-whitespace text
- amount is an integer in `[1, 1_000_000]`
- rejection reason is nonblank when rejecting

Validation should happen before repository lookup, including the required `id` field for operations that reference an existing expense. Invalid inputs return `400`.

I will use explicit schemas per command type rather than a single loose parser, because each operation has different required fields.

## Workflow Rules

### Create

- If the input is invalid, return `400`.
- If the ID already exists, preserve the original record and return `409`.
- Otherwise create a new `draft` expense, store it, log a success event, and return `201`.

### Submit

- Validate first.
- Load the expense.
- If missing, return `404`.
- If not in `draft`, return `409`.
- If the actor is not the owner, return `403`.
- Otherwise transition to `submitted`, store, log, and return `200`.

### Approve

- Validate first.
- Load the expense.
- If missing, return `404`.
- If not in `submitted`, return `409`.
- If the actor is the owner, return `403`.
- Otherwise transition to `approved`, store, log, and return `200`.

### Reject

- Validate first.
- Load the expense.
- If missing, return `404`.
- If not in `submitted`, return `409`.
- If the actor is the owner, return `403`.
- Otherwise transition to `rejected` with the required reason, store, log, and return `200`.

### Pay

- Validate first.
- Load the expense.
- If missing, return `404`.
- If not in `approved`, return `409`.
- If already `paid`, return the stored receipt immediately with `200`, without calling the gateway or writing storage again.
- Call the payment gateway with `expenseId` as the idempotency key.
- If the gateway declines, return `422` with `{ code: "payment_declined" }` and do not mark the expense paid.
- If the gateway rejects, throws, or returns an unusable shape, return `500`.
- If it returns a nonempty receipt ID, store `paid` plus the receipt, log, and return `200`.

### Get

- Validate first.
- Load the expense.
- If missing, return `404`.
- Otherwise return the public expense body for the current state.

## Error Mapping

Expected failures should be translated into stable HTTP-style responses:

- invalid command or invalid field values -> `400`
- unauthorized submit or self-review -> `403`
- missing expense -> `404`
- duplicate ID or wrong state for the requested operation -> `409`
- payment declined -> `422` with code `payment_declined`
- storage/gateway failure or unusable gateway response -> `500`

Operation state checks should come before payment work, and authorization checks should only be evaluated when the operation is otherwise valid for the current state.

## Privacy Rules

`ownerEmail` is internal-only data.

- Never include it in the returned body.
- Never include it in logger events.
- Never leak it through error codes or diagnostic text.

Successful operations should log only the expense ID and the action, for example:

- `expense.created`
- `expense.submitted`
- `expense.approved`
- `expense.rejected`
- `expense.paid`

Repeating a completed payment is not a new change, so it should not emit another payment log entry.

## Testing Plan

Add focused tests that cover:

- command validation for each operation
- duplicate create preserves the original record
- submit authorization and self-review rejection
- review transitions and terminal states
- payment success, decline, gateway failure, and idempotent repeat payment
- response bodies never contain `ownerEmail`
- logger events never contain `ownerEmail`
- `get` works in every state

Tests should be table-driven where possible so the state machine remains easy to audit.

