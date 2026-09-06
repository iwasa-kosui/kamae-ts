# Expense Approval Service Design

## Scope

This service will export `createExpenseService(dependencies)` from `src/index.ts`.
The returned service will expose one asynchronous `handle(command)` method that
accepts JSON-like commands from the host and returns the response shape defined
in `API.md`.

There will be no UI, HTTP server, authentication provider, scheduler, or crash
recovery layer. Calls are assumed to be sequential, matching `PRD.md`.

## Library Choices

Runtime dependencies:

- `zod@4.1.5` for boundary validation and branded value types.
- `neverthrow@8.2.0` for expected workflow outcomes.

Zod is the smallest practical choice for validating arbitrary commands and
stored JSON values. `neverthrow` keeps domain errors explicit without using
exceptions for expected business results. Unexpected rejected promises from the
host repository or payment gateway will remain exceptions until the command
adapter catches them and converts them to status `500`.

## Module Layout

Application and tests will live under `src/`.

```text
src/
  index.ts
  api/
    command.ts
    response.ts
    handle-command.ts
  domain/
    amount-cents.ts
    employee-id.ts
    expense-description.ts
    expense-id.ts
    owner-email.ts
    receipt-id.ts
    sensitive.ts
    expense.ts
    expense-by-id-resolver.ts
    expense-store.ts
    payment-gateway.ts
    diagnostic-logger.ts
  storage/
    stored-expense.ts
    expense-record-mapper.ts
  use-cases/
    create-expense.ts
    submit-expense.ts
    approve-expense.ts
    reject-expense.ts
    pay-expense.ts
    get-expense.ts
  support/
    assert-never.ts
    schema-result.ts
  *.test.ts
```

The domain layer owns the dependency contracts it needs: read, write, payment,
and diagnostic logging. Concrete adapters around the host's `repository`,
`payment`, and `logger` will be composed in `index.ts`.

## Domain Model

Expense state will be represented as a discriminated union using `kind`:

- `DraftExpense`
- `SubmittedExpense`
- `ApprovedExpense`
- `RejectedExpense`
- `PaidExpense`

Each state will contain the fields required by that state instead of optional
state-specific properties. Common values include `id`, `ownerId`, `ownerEmail`,
`description`, and `amountCents`. Reviewed states add `reviewerId`; rejected
states add `reason`; paid states add `receiptId`.

Pure transition functions on the `Expense` companion object will define valid
state changes:

- `create(...) -> DraftExpense`
- `submit(DraftExpense) -> SubmittedExpense`
- `approve(SubmittedExpense, reviewerId) -> ApprovedExpense`
- `reject(SubmittedExpense, reviewerId, reason) -> RejectedExpense`
- `markPaid(ApprovedExpense, receiptId) -> PaidExpense`

Use cases will check actor rules before calling transition functions:

- only owner can submit
- reviewer must differ from owner
- rejected and paid states are final for review/payment purposes

The response model will use API state strings (`draft`, `submitted`, `approved`,
`rejected`, `paid`). Internally, `kind` remains the domain discriminant.

## Boundary Validation

Every external boundary will be parsed at runtime:

- incoming command values
- stored repository values
- payment gateway responses

Command schemas will be defined per operation with required fields enforced even
when the expense ID does not exist. Extra command fields will be ignored.

Domain value objects will use Zod schemas on companion objects:

- ID fields: nonempty strings
- owner email: syntactic email validation
- description and rejection reason: trimmed nonblank strings
- amount: integer from `1` through `1_000_000`
- receipt ID: nonempty string

The owner email will be wrapped in `Sensitive<T>` when parsed, so accidental
serialization or diagnostic logging redacts it. The mapper will unwrap it only
when saving to host storage or sending the payment request.

## Storage Format

The host repository stores JSON values. The service will store one JSON object
per expense ID with a version marker:

```json
{
  "schemaVersion": 1,
  "kind": "ApprovedExpense",
  "id": "exp-1",
  "ownerId": "emp-1",
  "ownerEmail": "employee@example.com",
  "description": "Taxi",
  "amountCents": 2500,
  "reviewerId": "emp-2"
}
```

The storage mapper will validate this representation on reads before converting
to domain values. Invalid stored data is treated as unusable storage and mapped
to status `500`, because the workflow cannot safely continue.

## Payment Design

`pay` will:

1. validate the command shape;
2. load and validate the expense;
3. return `409` unless it is approved or already paid;
4. return the existing receipt immediately for paid expenses, without calling
   the gateway or writing storage;
5. call `payment.charge` with the recorded amount, unwrapped owner email,
   expense ID, and the expense ID as `idempotencyKey`;
6. return `422` with `payment_declined` if declined;
7. require a nonempty receipt ID for success;
8. save the paid state only after a confirmed receipt.

Gateway rejection or an unusable gateway response returns status `500`. Declines
are expected business outcomes and remain retryable because the approved expense
is not modified.

## Response and Error Mapping

The command adapter will be the only layer that knows API status codes.

Success responses:

- `create`: status `201`
- all other successful operations: status `200`
- body excludes `ownerEmail`
- body includes `reviewerId`, `reason`, or `receiptId` only when present

Unsuccessful responses:

- validation failure: `400`, code `invalid_command`
- unauthorized submit or self-review: `403`
- missing expense: `404`
- duplicate ID or invalid workflow stage: `409`
- payment declined: `422`, code `payment_declined`
- repository, gateway, invalid stored data, or unusable receipt: `500`

Diagnostic logs will be emitted only after successful state-changing operations:
`create`, `submit`, `approve`, `reject`, and first successful `pay`. Log events
will contain expense ID and action only, never owner email.

## Test Plan

Tests will use Bun's test runner under `src/`.

Coverage will focus on:

- command validation rejects invalid required fields without storage writes;
- duplicate create preserves the original record;
- owner-only submit;
- self-review forbidden;
- approve/reject only from submitted state;
- rejection requires a nonblank reason and is final;
- payment calls the gateway with recorded amount/email and ID idempotency key;
- declined payment is retryable and does not save paid state;
- repeated paid command returns the existing receipt without gateway or storage;
- responses and logs never expose owner email;
- storage or gateway rejection maps to `500`;
- invalid stored JSON maps to `500`;
- missing IDs require valid command fields before returning `404`.

Fixtures will use `as const satisfies Type` where they target domain types.

## Assumptions

- Employee IDs are only required to be nonempty strings; no format beyond that is
  specified.
- "Syntactically valid email" will use Zod's email string validation.
- Repository `save(id, value)` replaces full expense records atomically for this
  sequential version.
- `logger.info(event)` is synchronous per `API.md`; if it throws, the adapter
  will treat that as an unexpected failure for the operation.
- Diagnostic events are required only for successful changes, not for no-op
  repeated payment returns.
