# Existing inventory reservation host contract

This document describes the unchanged starter. The requested additions are in
`CHANGE.md`. The host authenticates callers and provides the dependency object.
Requests are sequential. All storage values are JSON, and successful storage
operations survive creation of a new service instance.

Export `createReservationService({ storage })` from `src/index.ts`. It returns an
object with asynchronous `handle(command)`. Commands can be any JSON value;
`handle` always resolves to `{ status, body }` for documented inputs and host
outcomes.

## Public operations (B1, B2)

| op | Required fields | Success |
| --- | --- | --- |
| getAvailability | sku | 200 { sku, totalUnits, reservedUnits, availableUnits } |
| getReservation | reservationId | 200 { reservationId, sku, quantity } |
| reserve | reservationId, sku, quantity | 201 { reservationId, sku, quantity } for a new reservation; 200 with the existing body for an exact repeat |

IDs are exact nonempty strings, including whitespace strings. Do not trim or
canonicalize them. Reserve quantity is an integer from 1 through 1,000,000.
Extra command fields are ignored. Required fields are validated before any host
call, including for missing or already-existing IDs.

Availability is totalUnits minus reservedUnits. A reservation requires existing
stock with sufficient availability. Once stored, reservations cannot be edited,
released or expired. A repeat reservationId with the same SKU and quantity returns
the original reservation without reading stock, committing or creating another
event. Reusing the ID for another payload returns reservation_conflict and
preserves the original.

| Failure | Status and body |
| --- | --- |
| Unsupported/malformed command or missing/invalid field | 400 { code: "invalid_command" } |
| Missing stock for getAvailability or reserve | 404 { code: "stock_not_found" } |
| Missing reservation for getReservation | 404 { code: "reservation_not_found" } |
| Insufficient available stock | 409 { code: "insufficient_stock" } |
| Existing reservation ID with different payload | 409 { code: "reservation_conflict" } |
| Commit returns revision_conflict | 409 { code: "commit_conflict" } |
| Storage rejection, unusable result/record, exhausted revision | 500 { code: "storage_unavailable" } |

Errors contain only the code. Do not expose host messages, request identifiers or
other error fields. No diagnostic logger is required.

## Storage methods and owned records (B3–B6)

The host supplies exactly these methods:

- `getStock(sku)`: resolves a stock record or undefined.
- `getReservation(reservationId)`: resolves a reservation record or undefined.
- `commitReservation(change)`: atomically applies a reservation change and
  resolves "committed" or "revision_conflict".

Every method can reject. Unknown/unusable result shapes must produce 500. The
TypeScript starter declares result values as unknown so a host can exercise these
documented error cases without changing dependency types.

Stock record:

```json
{ "sku": "widget", "totalUnits": 12, "reservedUnits": 5, "revision": 8 }
```

Stock quantities are integers from 0 through 1,000,000; reservedUnits cannot exceed
totalUnits. Revision is a nonnegative safe integer. The record SKU must equal the
requested lookup key. A reservation record is:

```json
{ "reservationId": "r-1", "sku": "widget", "quantity": 3 }
```

Its ID must equal the requested lookup key; quantity has the command's positive
integer bounds. The host seeds stock; the service creates reservations. Only
undefined means missing. Null and malformed present records are unusable.

A commit request has this JSON shape:

```json
{
  "expectedRevision": 8,
  "nextStock": { "sku": "widget", "totalUnits": 12, "reservedUnits": 8, "revision": 9 },
  "reservation": { "reservationId": "r-1", "sku": "widget", "quantity": 3 },
  "events": [{
    "eventId": "reservation.created:r-1",
    "type": "reservation.created",
    "reservationId": "r-1",
    "sku": "widget",
    "quantity": 3
  }]
}
```

The application must send the revision it loaded as expectedRevision and increment
the stock revision by exactly one. If that increment is no longer a safe integer,
return storage_unavailable before commit.

The host checks expectedRevision against the current stock revision. If they do
not match, it returns revision_conflict and changes nothing. Otherwise it stages
the supplied stock replacement, reservation insertion, and every supplied event
and commits them together. A rejected commit, including failure after any staged
write, commits none of them. The host has no application rule that invents missing
events: an empty events array is a valid infrastructure batch, so the service is
responsible for including exactly the required event. Events are indexed by
eventId; successful new reservations must append exactly one matching event, with
eventId equal to "reservation.created:" plus the exact reservationId.

No observer sees a partially staged commit. Fault fixtures for unusable commit
results return them before commit. Ambiguous acknowledgements after successful
commit are outside scope; do not invent cross-resource compensation. A failed
commit can be retried. A completed reservation retry must perform no commit and
must not duplicate the event.

## Scope

No concurrency algorithm, crash recovery, distributed transaction, real SDK,
database, broker, event relay, authentication, UI or network is requested. Revision
conflict is a documented host outcome to preserve, not a request to implement a
concurrency protocol. Only the implementation's own stored records need round-trip
support; no migrations or recovery from arbitrary legacy data tampering are
required. Host error details are private transport details, not a free-text DLP
task. No logger behavior is required.
