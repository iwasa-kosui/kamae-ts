# Design: Employee Expense Approval

## Scope

The product will be a server-side TypeScript module exported from `src/index.ts`:

```ts
createExpenseService(dependencies).handle(command)
```

It will not provide UI, HTTP routing, authentication, deployment, background jobs, crash recovery, or concurrent request coordination. The host owns caller authentication and finance authorization. The module will validate untrusted command and storage values, enforce the expense workflow, call the supplied payment gateway, persist confirmed state changes, and return the API response shape from `API.md`.

## Assumptions

- Repository values are JSON-compatible values persisted across service instances, so the module must validate data read from `repository.get`.
- Requests are sequential as stated in `PRD.md`; no compare-and-swap or transaction abstraction is available.
- `pay` callers are already authorized finance users by the host, so no actor field is required or checked for payment.
- Required command fields must be validated before lookup, including when an expense ID is missing.
- Diagnostic logger events must not include owner email, command bodies, raw stored values, or payment request payloads.
- Repeated payment for an already paid expense should avoid repository writes and payment calls.

## Library Choices

I will add these exact runtime dependencies:

- `zod@4.1.5` for command validation, stored JSON validation, branded primitive parsing, and PII wrapping.
- `neverthrow@8.2.0` for expected business results inside use cases.

These choices match the Kamae guidance in the supplied skill: external boundaries are schema-validated, expected workflow failures are modeled as discriminated-union `Result` errors, and unexpected infrastructure failures are handled at the application boundary.

## Architecture

The implementation will be small but layered:

- `src/index.ts`: composition root and exported `createExpenseService`.
- `src/api/`: command schemas, response mapping, dependency type definitions, and the `handle` boundary.
- `src/domain/expense/`: expense state union, branded value objects, pure transition functions, storage resolver/store contracts, and payment contract.
- `src/application/`: use cases for create, submit, approve, reject, pay, and get.
- `src/shared/`: `Sensitive<T>`, schema-to-result helper, `assertNever`, and JSON-safe helper types if needed.

The host supplies a broad `repository` object, but domain-facing contracts will stay narrow:

- `ExpenseByIdResolver` with `findById(id)`.
- `ExpenseStore` with `save(expense)`.
- `ExpensePaymentGateway` with `charge(expense)`.
- `ExpenseLogger` with `info(event)`.

Adapters in `src/api/` will translate the host contracts to these narrower domain contracts.

## Domain Model

Expense states will be represented as immutable discriminated unions using `kind` internally:

- `DraftExpense`: created but not submitted.
- `SubmittedExpense`: submitted by its owner.
- `ApprovedExpense`: reviewed by a different employee and approved.
- `RejectedExpense`: reviewed by a different employee with a nonblank reason; final.
- `PaidExpense`: paid with a nonempty receipt ID; final.

Common fields will be repeated in each state rather than inherited:

- `id`
- `ownerId`
- `ownerEmail` as `Sensitive<OwnerEmail>`
- `description`
- `amountCents`

Review states add `reviewerId`; rejected adds `reason`; paid adds `receiptId` and retains `reviewerId`.

Pure transition functions will live on the `Expense` companion:

- `create(validCreateInput): DraftExpense`
- `submit(draft, actorId): Result<SubmittedExpense, UnauthorizedSubmit>`
- `approve(submitted, actorId): Result<ApprovedExpense, SelfReview>`
- `reject(submitted, actorId, reason): Result<RejectedExpense, SelfReview>`
- `markPaid(approved, receiptId): PaidExpense`

Workflow-invalid source states will be rejected in use cases before calling transitions, returning `409`.

## Validation

All command inputs are external JSON and will be parsed with Zod schemas before any business or storage operation. Schemas will enforce:

- IDs: strings with at least one character after basic string validation.
- Owner email: syntactically valid email, transformed to `Sensitive<OwnerEmail>`.
- Description: contains non-whitespace text.
- Amount: integer from `1` through `1_000_000`.
- Rejection reason: contains non-whitespace text.
- Required fields: present for each command, even when the expense ID does not exist.

Stored repository values will also be parsed on every read. This prevents malformed persisted JSON from flowing into the domain model. An invalid stored value will be treated as an unavailable/unusable storage response and mapped to `500`, because the module cannot safely continue.

Storage format will be implementation-owned and explicit:

```ts
{
  version: 1,
  kind: "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid",
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

The public API response will map internal `kind` values to the required lowercase `state` values and will omit `ownerEmail`.

## Error Handling and Response Mapping

Use cases will return `Result<Expense, UseCaseError>` for expected outcomes:

- validation failure: `400`
- duplicate ID: `409`
- missing expense: `404`
- unauthorized submit: `403`
- self-review: `403`
- unavailable operation at current state: `409`
- payment declined: `422` with code `payment_declined`

Repository and gateway rejections are infrastructure failures and will be caught only at the `handle` boundary, returning `500`. The payment use case is special because the gateway can produce two expected successful transport outcomes:

- `{ kind: "declined" }` maps to `422` and does not save.
- `{ kind: "paid", receiptId }` with a nonblank receipt persists a paid expense.

An empty receipt ID or otherwise unusable gateway response maps to `500` and is not saved as paid.

## Payment Idempotency

The payment use case will:

1. Validate the command.
2. Load and validate the expense.
3. Return the existing receipt immediately if the expense is already `Paid`.
4. Reject non-`Approved` states with `409`.
5. Call `payment.charge` with `expenseId`, `amountCents`, `ownerEmail.unwrap()`, and `idempotencyKey` equal to the expense ID.
6. Save `PaidExpense` only after a valid nonempty receipt ID is returned.
7. Log the successful payment event after persistence.

Because repeated completed payment returns from step 3, it performs no gateway call and no storage write.

## PII and Logging

Owner email is needed for storage and payment but must not appear in responses or diagnostic logs. I will wrap email in `Sensitive<T>` at command/storage parse time:

- `unwrap()` exposes the email only at the payment/storage adapter boundary.
- `toJSON()`, `toString()`, and Node inspect return `[REDACTED]`.

Logger events will be small allowlisted objects such as:

```ts
{ expenseId: "exp-1", action: "approved", actorId: "emp-2" }
```

No error response body will include field values, emails, raw dependency errors, or stored records.

## Testing Plan

Tests will be written under `src/` using Bun's test runner. Coverage will focus on observable API behavior:

- Create succeeds, rejects invalid fields, and preserves original record on duplicate IDs.
- Submit only succeeds for the owner and only from draft.
- Approve/reject only succeed from submitted, reject self-review, and require nonblank rejection reason.
- Final states cannot be reviewed or paid outside the specified workflow.
- Get returns every state without owner email and returns `404` for missing IDs after validating required fields.
- Payment sends exact amount/email/idempotency key, stores receipt only on valid paid responses, returns declined without save, and returns existing receipt with no second gateway call.
- Repository/gateway rejection and malformed stored/gateway data map to `500`.
- Logger receives successful change events without owner email.

Test fixtures will use `as const satisfies` for discriminated unions where useful, following the Kamae test-data guidance.
