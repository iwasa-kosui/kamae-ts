# Expense Approval Design

## Scope

Build a single server-side TypeScript module that exports `createExpenseService(dependencies)` from `src/index.ts`. The module exposes one async `handle(command)` entry point and implements the expense workflow described in `PRD.md` and `API.md`.

This design assumes:

- No runtime dependencies are added in this phase.
- Validation and branded types will be implemented with local TypeScript helpers instead of a third-party schema library.
- Requests are sequential, so the design does not add locking or recovery logic for concurrent access or crash replay.
- The host provides trusted interfaces, but their returned values still need runtime validation at the boundary.

## Product Model

An expense has one lifecycle with these states:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `paid`

The model uses discriminated unions with `kind` as the only state tag. State-specific fields are required only where they apply.

Proposed persisted shape:

```ts
type ExpenseRecord = Readonly<{
  kind: "Expense";
  id: ExpenseId;
  ownerId: EmployeeId;
  ownerEmail: EmailAddress;
  description: ExpenseDescription;
  amountCents: AmountCents;
  state: ExpenseState;
}>;

type ExpenseState =
  | Readonly<{ kind: "draft" }>
  | Readonly<{ kind: "submitted" }>
  | Readonly<{ kind: "approved"; reviewerId: EmployeeId }>
  | Readonly<{ kind: "rejected"; reviewerId: EmployeeId; reason: string }>
  | Readonly<{ kind: "paid"; receiptId: string }>;
```

Why this shape:

- It keeps the owner email in storage, where it is needed for payment, while excluding it from responses and logs.
- It preserves the review trail required by the PRD.
- It lets repeated payment return the stored receipt without another gateway call.

## Domain Types

The implementation will define small, focused domain files under `src/`:

- `expense-id.ts`
- `employee-id.ts`
- `email-address.ts`
- `expense-description.ts`
- `amount-cents.ts`
- `expense.ts`
- `command.ts`
- `service.ts`
- `index.ts`

Each concept owns its parser and type. IDs and sensitive values are branded with `unique symbol`-based nominal types so employee IDs, expense IDs, and strings cannot be mixed accidentally.

Example responsibilities:

- `ExpenseId.parse(raw)` rejects empty strings.
- `EmployeeId.parse(raw)` rejects empty strings.
- `EmailAddress.parse(raw)` accepts only syntactically valid email strings.
- `ExpenseDescription.parse(raw)` requires non-whitespace text.
- `AmountCents.parse(raw)` requires an integer from `1` to `1_000_000`.

## Command Boundary

`handle(command)` accepts `unknown` JSON values and validates them before any workflow logic runs.

Commands are discriminated by `op`:

- `create`
- `submit`
- `approve`
- `reject`
- `pay`
- `get`

Validation rules:

- Unknown `op` is a `400`.
- All required fields are validated even when the expense ID does not exist.
- Extra fields are ignored.
- Invalid field shapes never reach the domain logic.

The parsing layer will return a local result type, not throw for expected invalid input.

## Workflow Design

The service orchestration will follow this sequence:

1. Parse and validate the command.
2. Load the expense if the command needs an existing record.
3. Apply a pure transition function.
4. Persist the new record only when the transition succeeds.
5. Emit a diagnostic log event only after a successful state change.

### Create

- Reject duplicate IDs with `409`.
- Persist a new expense in `draft`.
- Return `201`.

### Submit

- Only the owner can submit.
- Drafts can transition to `submitted` only.
- Unauthorized submit returns `403`.
- Wrong stage returns `409`.

### Approve / Reject

- The reviewer must be a different employee from the owner.
- Self-review returns `403`.
- Only `submitted` expenses can be reviewed.
- Approval stores `reviewerId`.
- Rejection stores `reviewerId` and a nonblank `reason`.
- Rejection is final.

### Pay

- Only `approved` expenses can be paid.
- The gateway request uses:
  - `expenseId` as the idempotency key
  - `amountCents` from storage
  - `email` from storage
- If the expense is already `paid`, return the stored receipt immediately.
- If the gateway declines, return `422` with `code: "payment_declined"`.
- If the gateway or storage is unavailable, return `500`.
- A successful payment must persist a nonempty `receiptId` before returning success.

### Get

- Return the stored expense at any stage.
- Missing IDs return `404`.
- Responses never include the owner email.

## External Dependency Contract

The service will accept these injected dependencies:

- `repository.get(id)`
- `repository.save(id, value)`
- `payment.charge({ expenseId, amountCents, email, idempotencyKey })`
- `logger.info(event)`

Boundary rules:

- `repository.get` and `repository.save` rejections become `500`.
- `payment.charge` rejections become `500`.
- A malformed repository payload or malformed payment response is treated as an unusable external response and becomes `500`.
- The logger is best-effort for successful changes; if logging fails, that failure should not change the workflow result unless the implementation is forced to surface it by the host contract.

## Response Mapping

Success payloads return:

- `id`
- `ownerId`
- `description`
- `amountCents`
- `state`
- `reviewerId` when reviewed
- `reason` when rejected
- `receiptId` when paid

Failure payloads return:

- `status`
- `{ code: string }`

Status mapping:

- `400` invalid command or invalid field
- `403` unauthorized submit or self-review
- `404` missing expense
- `409` duplicate ID or unavailable workflow stage
- `422` payment declined
- `500` storage/gateway failure or unusable gateway response

## Privacy and Logging

The owner email is treated as sensitive data:

- It is stored for payment use.
- It is never returned in a response body.
- It is never written to diagnostic logs.

Successful state changes emit a diagnostic event that identifies the expense and the action, for example:

```ts
{ kind: "expense_event", action: "approved", expenseId }
```

No log event is emitted for a `get` response or for a failed workflow.

## Testing Strategy

Tests will live under `src/` alongside the implementation and use Bun’s built-in test runner.

Coverage will focus on:

- Validation failures for each command and field
- Duplicate create and missing-record behavior
- Ownership and self-review restrictions
- State transition enforcement across all workflow stages
- Payment decline, payment success, repeated payment, and gateway malformed response handling
- Repository and gateway failure paths
- Response shaping, especially exclusion of `ownerEmail`
- Log event shape and the absence of PII

The tests will use small in-memory fakes for repository, payment, and logger so call counts and stored values can be asserted precisely.

## Implementation Note

The code will favor small pure transition functions plus a thin service orchestrator. That keeps workflow rules testable without requiring I/O to be mocked inside the domain logic.
