# Expense Approval Service Design

## Scope

Build a server-side TypeScript module exported from `src/index.ts`:

```ts
createExpenseService(dependencies).handle(command)
```

The service accepts untrusted JSON commands, uses the host repository, payment gateway, and logger, and returns the transport shape from `API.md`. It does not provide HTTP, UI, authentication, authorization for finance, deployment, crash recovery, or concurrent request handling.

## Dependency Choice

No runtime dependencies will be added.

Reasoning:

- The workflow is small and sequential, and LADDER directs the implementation toward standard language features and small direct functions before introducing packages.
- Runtime validation can be expressed clearly with narrow validators for this API surface.
- Expected outcomes can be modeled with a local `Result` union instead of a package-wide result library.
- The benchmark allows no additional packages as a valid choice, and avoiding dependencies removes install/version risk for this phase.

This intentionally deviates from the kamae validation/result library preference because no library is present, the user authorized unattended choices, and the minimum sufficient design does not require a package.

## Module Organization

Implementation will live under `src/` only.

Planned files:

- `src/index.ts`: public factory, dependency types, and exported API surface.
- `src/domain/expense.ts`: expense states, pure transitions, response projection.
- `src/domain/expense-id.ts`: ID validation and type alias/brand helper.
- `src/domain/employee-id.ts`: employee ID validation and type alias/brand helper.
- `src/domain/email.ts`: email validation and sensitive wrapper construction.
- `src/domain/money.ts`: amount validation.
- `src/domain/sensitive.ts`: closure-backed `Sensitive<T>` wrapper for PII.
- `src/domain/result.ts`: tiny `Result<T, E>` helpers for expected domain outcomes.
- `src/application/handle-command.ts`: command dispatch, orchestration, storage/payment error boundary.
- `src/application/command-validation.ts`: runtime command parsers.
- `src/application/stored-expense.ts`: repository record validation/mapping.
- `src/application/responses.ts`: status/code mapping.
- `src/index.test.ts`: end-to-end behavior tests through `createExpenseService`.

I may collapse files where a separate concept would add ceremony without protecting an invariant, but I will keep the public adapter, domain transitions, boundary validation, and tests separated.

## Domain Model

Expenses will be represented as immutable discriminated unions with `kind` as the internal state discriminant:

- `DraftExpense`
- `SubmittedExpense`
- `ApprovedExpense`
- `RejectedExpense`
- `PaidExpense`

Common fields:

- `id`
- `ownerId`
- `ownerEmail` as `Sensitive<Email>`
- `description`
- `amountCents`

State-specific fields:

- reviewed states include `reviewerId`
- rejected includes `reason`
- paid includes `receiptId`

Pure transition functions:

- `submit(draft, actorId) -> SubmittedExpense`
- `approve(submitted, reviewerId) -> ApprovedExpense`
- `reject(submitted, reviewerId, reason) -> RejectedExpense`
- `markPaid(approved, receiptId) -> PaidExpense`

Unavailable transitions are checked by orchestration before calling the pure transition. The transition argument types also prevent accidental invalid source states in code.

The API response uses `state` values from the spec (`draft`, `submitted`, `approved`, `rejected`, `paid`) while the internal domain uses `kind`.

## Boundary Validation

Every command is treated as `unknown` and parsed before use. Required fields must be present even if the target ID later turns out to be missing.

Validation rules:

- command must be a non-null object with a string `op`
- IDs: nonempty strings
- owner email: syntactically valid email with a conservative local regex
- description: contains non-whitespace text
- amount: integer from `1` through `1_000_000`
- reject reason: contains non-whitespace text

Extra fields are ignored.

Repository data is also treated as untrusted JSON and validated before the service uses it. Invalid stored data is an unusable storage response and maps to a `500` response, because the host preserves the storage format but the adapter still cannot trust arbitrary JSON at runtime.

## Storage Format

The repository will store plain JSON records with explicit `kind` values and the owner email as a plain string, because the host repository stores JSON and the payment gateway needs the email later.

Stored record shape will mirror the domain state:

```ts
{
  kind: "draft" | "submitted" | "approved" | "rejected" | "paid",
  id: string,
  ownerId: string,
  ownerEmail: string,
  description: string,
  amountCents: number,
  reviewerId?: string,
  reason?: string,
  receiptId?: string
}
```

Mapping into the domain wraps `ownerEmail` in `Sensitive<Email>`. Mapping to API responses never includes `ownerEmail`.

## Command Behavior

`create`:

- validate all create fields
- `repository.get(id)`
- if found, return `409 duplicate_id` without saving
- otherwise save a draft, log a create event, return `201`

`submit`:

- validate `id` and `actorId`
- missing expense returns `404`
- only owner can submit; otherwise `403`
- only draft can submit; otherwise `409`
- save submitted state, log event, return `200`

`approve`:

- validate `id` and `actorId`
- missing expense returns `404`
- only submitted can be reviewed; otherwise `409`
- owner cannot review own expense; otherwise `403`
- save approved state, log event, return `200`

`reject`:

- validate `id`, `actorId`, and nonblank `reason`
- missing expense returns `404`
- only submitted can be reviewed; otherwise `409`
- owner cannot review own expense; otherwise `403`
- save rejected state, log event, return `200`

`pay`:

- validate `id`
- missing expense returns `404`
- paid expense returns existing receipt with no gateway call and no storage write
- only approved can be paid; otherwise `409`
- call payment with recorded amount, unwrapped owner email, and `id` as idempotency key
- declined returns `422` with code `payment_declined` and no save
- paid with a nonblank `receiptId` saves paid state, logs event, returns `200`
- unusable payment response maps to `500`

`get`:

- validate `id`
- missing expense returns `404`
- return projected expense without owner email

## Error Mapping

Expected failures map to API responses:

- invalid command or invalid fields: `400 invalid_command`
- unauthorized submit or self-review: `403 forbidden`
- missing expense: `404 not_found`
- duplicate ID: `409 duplicate_id`
- invalid state for operation: `409 invalid_state`
- payment declined: `422 payment_declined`

Repository rejections, gateway rejections, invalid stored records, and unusable gateway success payloads map to `500 service_unavailable` or `500 invalid_dependency_response`. These responses will not include the owner email.

## Logging and PII

Successful state changes will call `logger.info(event)` with only non-PII fields:

```ts
{ expenseId, action }
```

Potential actions:

- `created`
- `submitted`
- `approved`
- `rejected`
- `paid`

The logger will not receive owner email, description, amount, rejection reason, or receipt ID unless needed by the spec. The spec only requires identifying the expense and action, so those fields will be omitted.

The `Sensitive<T>` wrapper masks `toJSON`, `toString`, and Node inspect output to reduce accidental diagnostic leakage inside implementation code. The email is unwrapped only for repository persistence and payment.

## Testing Plan

Tests will exercise the public `handle` API with in-memory fakes.

Core coverage:

- create success, invalid create, duplicate create preserves original
- submit owner-only rule and invalid state conflict
- approve success, self-review forbidden, review only submitted
- reject success, nonblank reason required, rejection final
- pay success passes exact amount/email/idempotency key and stores receipt
- repeat pay returns same receipt without gateway call or storage write
- declined payment returns `payment_declined` and can be retried
- gateway unavailable and unusable paid response return `500` and do not mark paid
- repository get/save failures return `500`
- get works for all states and never returns owner email
- required command fields are validated before missing-ID handling
- successful changes log non-PII events

Fixtures will use `as const satisfies` where useful to keep discriminants narrow.

## Assumptions

- Email validation only needs practical syntax checking, not DNS or deliverability checks.
- Owner and actor IDs are employee IDs, and the product only requires nonempty string validation.
- The host performs finance authorization for `pay`; the command intentionally has no finance actor field.
- Sequential requests mean duplicate/create and pay flows do not need locks or compare-and-swap behavior.
- `logger.info` is synchronous per `API.md`; if it throws unexpectedly, the service will treat that as an application failure rather than silently hiding it.
- Storage preserves implementation JSON across service instances, so future instances must continue to parse the stored shape described above.
