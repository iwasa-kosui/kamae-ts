# Employee Expense Approval Design

## Scope

The product will be delivered as a server-side TypeScript module exporting
`createExpenseService(dependencies)` from `src/index.ts`. It will not include a
UI, HTTP server, authentication, deployment code, or process-crash recovery.
All command handling will happen through the supplied `handle(command)` adapter.

## Dependency choices

- `zod@3.25.76` for command and stored-record validation, branded IDs, amount
  constraints, email syntax checks, and owner-email wrapping.
- `neverthrow@8.2.0` for expected business outcomes such as duplicate IDs,
  missing expenses, invalid workflow stage, unauthorized submit, self-review,
  and declined payment.

These are the smallest runtime libraries that match the supplied kamae defaults.
Storage and payment rejections remain native promise failures and are converted
to `500` only at the service boundary, because the product does not define a
domain recovery path for those infrastructure failures.

## Domain model

Expenses will be represented as immutable discriminated unions using `kind` as
the internal state discriminator:

- `DraftExpense`: created and not submitted.
- `SubmittedExpense`: awaiting review.
- `ApprovedExpense`: reviewed and eligible for payment.
- `RejectedExpense`: final, includes `reviewerId` and `reason`.
- `PaidExpense`: final, includes `reviewerId` and `receiptId`.

Common fields are repeated in each state instead of inherited:
`id`, `ownerId`, `ownerEmail`, `description`, and `amountCents`.
The owner email is modeled as `Sensitive<Email>` so accidental JSON/string
serialization redacts it, while payment can explicitly unwrap it.

Pure transition functions on the `Expense` companion will cover:

- `submit(draft, actorId)`
- `approve(submitted, reviewerId)`
- `reject(submitted, reviewerId, reason)`
- `markPaid(approved, receiptId)`

Workflow checks that depend on the current union variant will return
use-case-specific `Result` errors. Valid source-state narrowing will keep each
transition explicit and testable.

## Boundary validation

Every external input is validated before entering domain logic:

- Incoming commands are parsed by an operation-discriminated Zod schema.
- Required command fields are validated before missing-expense checks, including
  commands whose target ID does not exist.
- Repository values are parsed by a stored-expense schema on every `get`.
- Gateway responses are validated before marking an expense paid.

Extra command fields will be ignored. Invalid commands and invalid stored input
will not be trusted by TypeScript assertions. Stored-record parse failures are
treated as unavailable/unusable storage and returned as `500`.

## Storage representation

The repository will store plain JSON records with `kind` values matching the
domain variants and with `ownerEmail` stored as the raw email string. On read,
the adapter validates the raw JSON and wraps the email into `Sensitive`.
On save, the adapter unwraps email and writes only the fields required for the
current state.

The host repository has `get(id)` and `save(id, value)`. Although kamae prefers
small read/write ports, this API is supplied by the host, so the composition
root will adapt it into narrow internal functions instead of exposing the broad
host dependency throughout the domain.

## Command handling

`handle(command)` will:

1. Parse the command.
2. Run the matching use case.
3. Map expected errors to the API status/code table.
4. Catch repository/payment rejections and invalid gateway/storage data as
   `500`.
5. Return public expense bodies without `ownerEmail`.

Create checks storage for the ID before saving. If the ID already exists, it
returns `409` without modifying the stored record.

Submit requires the actor to match `ownerId` and the expense to be draft.

Approve/reject require the expense to be submitted and the reviewer to differ
from `ownerId`. Reject additionally requires a nonblank reason and is final.

Pay requires the expense to be approved. It calls the gateway with:
`expenseId`, `amountCents`, unwrapped `email`, and `idempotencyKey` equal to the
expense ID. A successful payment requires `{ kind: "paid", receiptId }` with a
nonempty receipt ID before the paid state is saved. Declines return
`422 payment_declined` and do not save. Repeating pay on an already paid expense
returns the existing receipt without a gateway call or storage write.

## Logging and privacy

Successful state-changing commands will call `logger.info` with minimal events:
`{ expenseId, action }`. Events will not include owner email, command payloads,
payment payloads, or stored records. `get` is not a state change and will not
log a success event.

Public response bodies include only:
`id`, `ownerId`, `description`, `amountCents`, `state`, and state-specific
`reviewerId`, `reason`, or `receiptId`.

## File organization

Planned implementation files under `src/`:

- `src/index.ts`: public factory and host-facing response mapping.
- `src/domain/expense.ts`: expense union, pure transitions, public projection.
- `src/domain/value-objects.ts`: branded IDs, email, amount, description,
  reason, and `Sensitive`.
- `src/application/commands.ts`: command schemas and parsed command type.
- `src/application/use-cases.ts`: create, submit, approve, reject, pay, get.
- `src/infrastructure/storage-codec.ts`: stored JSON validation and mapping.
- `src/infrastructure/payment-codec.ts`: gateway response validation.
- `src/result.ts`: small shared validation/result helpers if needed.

Files may be split further if one concept grows enough to justify it; no generic
ports directory or speculative extension layer is planned.

## Test plan

Tests will be written under `src/` with Bun's test runner. They will cover:

- Create validation, duplicate ID preservation, and no save on invalid input.
- Submit ownership and stage restrictions.
- Approve/reject self-review, required rejection reason, final rejection, and
  paid-review conflicts.
- Pay success, idempotent repeat without gateway/save calls, decline retry
  behavior, unusable gateway response, and gateway/storage rejection mapping.
- Get at each stage, missing IDs, command validation before missing checks, and
  response privacy.
- Logger privacy for successful changes.

Fixtures will use `as const satisfies Type` where they target domain types.

## Assumptions

- Command `op` is the operation discriminator.
- IDs are valid when they are nonempty strings after no trimming; descriptions
  and rejection reasons must contain non-whitespace text.
- Email syntax validation can use Zod's `email()` check.
- `logger.info` is synchronous as specified; if it throws unexpectedly, the
  service boundary will treat that like an unavailable dependency and return
  `500`.
- A malformed stored record means the storage service is unusable for that
  request, so the response is `500` rather than a domain conflict.
