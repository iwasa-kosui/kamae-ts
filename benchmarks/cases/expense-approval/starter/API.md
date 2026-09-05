# Host integration

Export `createExpenseService(dependencies)` from `src/index.ts`. It returns an
object with an asynchronous `handle(command)` method. Commands are JSON values.
Internal organization, types, storage format, and libraries are your choice.

The host passes these objects:

| Object | Method | Behavior |
| --- | --- | --- |
| repository | `get(id)` | Resolves to the stored JSON value, or undefined if missing |
| repository | `save(id, value)` | Inserts or replaces a JSON value; resolves on success |
| payment | `charge({ expenseId, amountCents, email, idempotencyKey })` | Resolves to `{ kind: "paid", receiptId: string }` or `{ kind: "declined" }` |
| logger | `info(event)` | Records a diagnostic event; returns nothing |

Repository and payment methods can reject on service failure. The storage format
belongs to your implementation and is preserved across service instances.

| Command op | Required fields |
| --- | --- |
| create | id, ownerId, ownerEmail, description, amountCents |
| submit | id, actorId |
| approve | id, actorId |
| reject | id, actorId, reason |
| pay | id |
| get | id |

`handle` resolves to `{ status, body }`. Success has status 200 (201 for create)
and a body containing id, ownerId, description, amountCents, and state (draft,
submitted, approved, rejected, or paid). Include reviewerId after review, reason
after rejection, and receiptId after payment. Do not include the owner email.

Unsuccessful responses have body `{ code: string }` and these status values:

| Situation | Status |
| --- | --- |
| Invalid command, including invalid fields | 400 |
| Unauthorized submit or self-review | 403 |
| Missing expense | 404 |
| Duplicate ID or operation unavailable at the current stage | 409 |
| Payment declined | 422 (code must be `payment_declined`) |
| Unavailable storage/gateway or unusable gateway response | 500 |

Extra command fields may be ignored. Code strings other than `payment_declined`
are your choice. This adapter specifies the host's transport format only.
