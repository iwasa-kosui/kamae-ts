# Design

## Assumptions

- Commands arrive as JSON objects with an `op` field whose value is one of `create`, `submit`, `approve`, `reject`, `pay`, or `get`.
- `repository.get` returns raw JSON-like data, so persisted records must be validated before use.
- No runtime validation or Result library is installed in this workspace, so the implementation will use small in-repo parsers and native `Promise`-based control flow instead of adding dependencies.
- Requests are sequential, so the design does not need transactions, locking, or crash recovery.
- The host owns authentication and authorization. This module only enforces the workflow rules in the PRD.

## Product Shape

This service is a small server-side workflow engine for expense approval:

- create an expense draft
- submit it by the owner
- approve or reject it by a different employee
- pay it after approval
- retrieve it at any stage

The core design choice is to model the expense as a discriminated union with `kind` representing the workflow state. That keeps the valid fields explicit in each stage and makes invalid transitions local and testable.

## Domain Model

I will represent the expense as a union of immutable state records:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `paid`

Each state will repeat the common identity and ownership fields so the state itself is self-describing:

- `id`
- `ownerId`
- `ownerEmail`
- `description`
- `amountCents`

State-specific fields:

- `approved` and `rejected` include `reviewerId`
- `rejected` includes `reason`
- `paid` includes `reviewerId` and `receiptId`

I am keeping the email on the internal expense record because the payment gateway requires it, but it will never be returned in API responses or logger events.

## State Transitions

The workflow is a strict progression:

| From | To | Rule |
| --- | --- | --- |
| none | `draft` | `create` records a new expense |
| `draft` | `submitted` | only the owner may submit |
| `submitted` | `approved` | a different employee may approve |
| `submitted` | `rejected` | a different employee may reject with a nonblank reason |
| `approved` | `paid` | finance may pay |

Terminal states:

- `rejected` cannot change again
- `paid` cannot change again

The implementation will keep the transition logic pure, with one small function per legal state change. That keeps workflow validation separate from repository/payment I/O.

## Validation Strategy

Because there is no schema library already installed, the implementation will use explicit runtime parsers for:

- incoming commands
- stored repository values
- payment gateway responses

Validation rules from the PRD will be enforced at the boundary:

- `id` must be a nonempty string
- `ownerId` and `actorId` must be nonempty strings
- `ownerEmail` must be syntactically valid
- `description` must contain non-whitespace text
- `amountCents` must be an integer between `1` and `1,000,000`
- rejection `reason` must be nonblank
- gateway success must include a nonempty `receiptId`

Invalid input will return `400` and will not be persisted or charged.

## Persistence Shape

The repository will store the internal expense union directly as JSON-compatible data. That keeps persistence simple and avoids a separate mapping layer.

On read:

- validate the raw object
- reject malformed stored values as a 500-level infrastructure failure

On write:

- save the updated expense record after a successful transition
- for payment, save only after the gateway confirms payment with a receipt

For repeated payment of an already paid expense, the service will return the stored receipt without calling the gateway again and without writing storage again.

## Workflow Orchestration

`createExpenseService(dependencies)` will return an object with `handle(command)`.

Implementation structure:

- parse command
- load expense if the command needs an existing record
- apply pure transition checks
- call payment gateway only for `pay`
- persist the new state only after the transition succeeds
- log a diagnostic event for successful changes
- map all outcomes to `{ status, body }`

This keeps I/O at the edge and domain decisions in pure code.

## Error Mapping

I will use the following response mapping:

- `400` for invalid command or invalid fields
- `403` for unauthorized submit or self-review
- `404` for missing expense
- `409` for duplicate ID or operation unavailable at the current stage
- `422` with code `payment_declined` when the gateway declines payment
- `500` for storage failure, gateway failure, or malformed gateway response

Expected business failures will be handled explicitly. Unexpected dependency failures will surface as 500 responses.

## Privacy And Diagnostics

The owner email is sensitive and will be treated as internal-only data.

Rules:

- responses must never include the email
- logger events must include only the expense id and action
- error responses must not leak the email

Successful actions will emit a minimal diagnostic event such as:

- `expense.created`
- `expense.submitted`
- `expense.approved`
- `expense.rejected`
- `expense.paid`

Each event will identify the expense and action only.

## Test Plan

The tests will focus on workflow correctness and boundary safety:

- validation rejects malformed commands
- create rejects invalid fields and duplicate ids
- submit enforces owner-only access
- approve/reject enforce different-employee review
- reject requires a nonblank reason
- paid expenses cannot be reviewed again
- payment decline returns `422` and does not persist paid state
- repeated payment returns the stored receipt without a second gateway call
- responses never expose `ownerEmail`
- logger events never expose `ownerEmail`

## File Layout

Implementation will live under `src/` with small files, one concept per file where practical:

- `src/index.ts` for `createExpenseService`
- domain files for expense state, commands, and validation helpers
- adapter code near the service boundary for repository, gateway, and logger coordination
- tests under `src/`

I am intentionally not adding extra abstractions beyond the workflow boundaries above. The current requirements do not justify a broader framework.
