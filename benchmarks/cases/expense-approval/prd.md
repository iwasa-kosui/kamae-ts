# Expense approval service

## Product goal

Employees submit expenses, another employee approves or rejects them, and finance
pays approved expenses. Build a server-side TypeScript module using a caller-supplied
repository. No UI, HTTP server, database driver, authentication provider, or deployment.
Callers are authenticated; actor IDs stand in for their identity. Requests are
sequential; distributed locking and concurrent updates are out of scope.

## Requirements

- **R1 — Create:** Create a draft with a caller-supplied unique ID, owner ID,
  owner email, description, and amount in integer USD cents (1–1,000,000).
  IDs must be nonempty strings. Email must be syntactically valid; description
  must contain non-whitespace text. Reject malformed commands with 400 before
  persistence or payment. Duplicate IDs return 409 and preserve existing data.
  Extra command properties may be ignored.
- **R2 — Submit:** Only the owner can submit a draft. Submission freezes its data.
  There is no edit command in this version.
- **R3 — Review:** A submitted expense can be approved or rejected by a different
  actor. Self-review returns 403. Rejection requires a nonblank reason. Record
  the reviewer; rejection is terminal.
- **R4 — Pay:** Only approved expenses can be paid. Charge the exact amount to
  the owner's email using the expense ID as the idempotency key. Record the
  receipt ID. Repeating pay on a paid expense returns its existing view without
  charging or saving again.
- **R5 — Recovery:** An explicit gateway `declined` response returns 422 with
  code `payment_declined`, leaves the expense approved, and permits retry.
  Gateway throws, repository rejections, malformed stored records, and malformed
  gateway responses are unexpected faults: reject the handle Promise for the
  host's error boundary. Do not convert them into business responses. No storage
  write on gateway failure.
- **R6 — Transitions:** Other command/state combinations return 409. `get` works
  in every state. Commands for missing IDs return 404. Validate required command
  fields even for missing IDs. Finance authorization for `pay` is performed by
  the host, so it needs no actor field.
- **R7 — Privacy:** Email is needed by persistence and the gateway only. Never
  expose it in views, error bodies, or diagnostic logs, including invalid input
  and exceptions. Log successful state changes with event name and expense ID.
  Do not mutate objects returned by the repository; they are snapshots.
- **R8 — Explain and verify:** Map requirements to modules, state and data types,
  boundaries, failure handling, privacy, and tests. Explain tradeoffs and an
  alternative. Implement focused tests. Document deviations from the original
  design in IMPLEMENTATION.md.

## Observable adapter contract

Export `createExpenseService` from `src/index.ts`, taking `Dependencies` and returning
`ExpenseService` from `src/contract.ts`. This is a test adapter, not an internal
domain model. Internal types, functions, classes, error representation, and file
layout are your choice. Zod and neverthrow are available, not mandatory. Do not
add dependencies or change the adapter contract.

| op | Required fields |
| --- | --- |
| create | id, ownerId, ownerEmail, description, amountCents |
| submit | id, actorId |
| approve | id, actorId |
| reject | id, actorId, reason |
| pay | id |
| get | id |

Success returns `{ status: 200, body: view }`, except create returns 201.
A view contains id, ownerId, description, amountCents, and state (draft, submitted,
approved, rejected, paid). Add reviewerId for reviewed/paid expenses, reason for
rejected expenses, and receiptId for paid expenses. No email.
Errors return `{ status: 400 | 403 | 404 | 409 | 422, body: { code: string } }`;
only the payment decline code is prescribed.

Repository `get` returns undefined for absence; `save` inserts or replaces by ID.
The storage representation is your choice. Gateway success is
`{ kind: 'paid', receiptId: nonempty string }`; decline is `{ kind: 'declined' }`.
