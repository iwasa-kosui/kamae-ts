# Inventory consumers and an alternative storage provider

Change the supplied working service to support the integrations below. Preserve
the existing behavior in `API.md`. Implement production code under `src/` and
write `IMPLEMENTATION.md` describing the changes, any deviations and validation
actually performed. Do not edit the supplied requirements or host contracts.
No runtime dependencies are necessary, but internal organization and error
representation are your choice.

## Existing obligations to preserve

- **B1.** Preserve createReservationService({ storage }).handle(command) and the three legacy commands, response shapes, status codes, required-field validation before I/O, and ignored extra fields described in starter/API.md.
- **B2.** Reserve only existing stock with sufficient availability. Exact duplicate reservation payloads return the existing reservation with 200; conflicting reuse returns 409 without replacing the original.
- **B3.** A successful new reservation atomically increases reservedUnits, advances revision by one, inserts its reservation, and appends exactly one matching reservation.created outbox event. Use the loaded revision as expectedRevision; revision conflict or commit rejection leaves all resources unchanged.
- **B4.** Legacy storage rejection, unusable result, invalid self-owned record, or exhausted safe-integer revision produces 500 storage_unavailable; revision_conflict produces 409 commit_conflict; public errors contain only the fixed code.
- **B5.** Preserve exact nonempty identifiers and required stock/reservation/event data in storage and responses. Persisted records written by the implementation work across fresh service instances.
- **B6.** Queries, invalid commands, business-rule failures, and completed-reservation retries do not commit state or events. Failed commits can be retried without creating duplicate events.

These IDs identify obligations, not additive deductions: one underlying defect can
violate several statements and must still be explained as one root cause.

## New obligations

- **C1.** Add createStockReport({ source }).handle({ op: 'lowStock', belowUnits }) using only readSnapshot. Return SKU-sorted items with availableUnits strictly below the threshold; empty results return items: [].
- **C2.** Add createObservationReceiver({ sink }).handle({ op: 'recordObservation', observationId, sku, observedUnits }) using only appendObservation. Accept unknown SKUs, never query or change inventory/reservations, and map stored/duplicate outcomes to the specified 201/200 bodies with first accepted observation winning.
- **C3.** Add createProviderBReservationService({ storage }) for provider B's documented lookup envelopes, decimal-string rows and atomic batch API, retaining all existing reservation behavior and self-written record round trips without requiring provider A or migration.
- **C4.** Each factory must work with only its documented host methods: legacy lookup/commit methods, report readSnapshot, observation appendObservation, or provider B read/commitBatch. Typed callers must not need dummy operations, casts, another provider, or unrelated initialization.
- **C5.** Validate all new commands before I/O: exact nonempty IDs and integer report/observation quantities from 0 through 1000000. Unknown operations and missing/invalid required fields return 400 invalid_command. Extra fields are ignored and do not enter observation payloads.
- **C6.** Reject unusable report snapshots, duplicate snapshot SKUs, malformed provider B envelopes/rows/canonical decimal strings, and invalid stock quantities with 500; distinguish provider B NO_SUCH_KEY from TEMPORARY_FAILURE and preserve exact keys and numeric public quantities.
- **C7.** Contain rejection/unusable outcomes from every new host operation as 500 storage_unavailable without provider messages/request IDs or envelopes in public responses. Map provider B revision_conflict to 409 commit_conflict, and preserve reservation atomicity and idempotency on that backend.

## Public integration surface

Export all four factories from `src/index.ts`. Each returns an asynchronous
`handle(command)` that resolves `{ status, body }`.

| Factory | Only provisioned host methods |
| --- | --- |
| createReservationService({ storage }) | storage.getStock, storage.getReservation, storage.commitReservation; unchanged legacy signatures |
| createStockReport({ source }) | source.readSnapshot |
| createObservationReceiver({ sink }) | sink.appendObservation |
| createProviderBReservationService({ storage }) | storage.read, storage.commitBatch |

A deployment does not acquire unrelated services. A caller with only the listed
methods must construct and use the consumer with normal TypeScript inference or
the exported public types, without `any`, unsafe assertions, dummy methods or
placeholder clients. Existing callers must remain source compatible. This is not
a requirement to use a particular number of internal interfaces or files.
Internally sharing an object, narrowing a larger object, capturing functions, or
using type-only imports is allowed when the actual caller/runtime obligations
remain as documented.

### Stock report (C1, C4, C5, C6, C7)

Command: `{ op: "lowStock", belowUnits }`, where belowUnits is an integer from 0
through 1,000,000. Other ops and missing/invalid fields return
`400 { code: "invalid_command" }` before reading the source. Extra command fields
are ignored.

`source.readSnapshot()` returns a JSON array of
`{ sku, totalUnits, reservedUnits }`. It represents one consistent snapshot with
at most one row per exact SKU. IDs are exact nonempty strings. Both quantities
are integers from 0 through 1,000,000, and reservedUnits cannot exceed totalUnits.
An empty snapshot is valid. No revision is required for these report-only rows.
The source may reject or return an unusable snapshot, including duplicate SKUs,
non-array values or malformed rows; return 500 for any such case.

Return `200 { items: [{ sku, availableUnits }] }` where availableUnits is
totalUnits minus reservedUnits and is strictly less than belowUnits. Sort items
by exact SKU using JavaScript string relational comparison (UTF-16 code-unit
order), not locale-dependent collation. Return `{ items: [] }` when no row meets
the threshold. The report must use the supplied snapshot and must not look up
individual SKUs or perform any mutation/event append. A stock row with total 10,
reserved 7 appears at threshold 4 and does not appear at threshold 3.

### Observation receiver (C2, C4, C5, C7)

Command:
`{ op: "recordObservation", observationId, sku, observedUnits }`.
Both IDs are exact nonempty strings. observedUnits is an integer from 0 through
1,000,000. Invalid/missing required fields and unknown ops return 400 before I/O.
Extra fields are ignored and never added to the event.

Call the supplied `sink.appendObservation(event)` with exactly these fields:

```json
{
  "type": "inventory.observed",
  "observationId": "o-1",
  "sku": "not-in-catalog-yet",
  "observedUnits": 7
}
```

This is an independent event workflow. Observations can arrive before catalog
import, so a valid unknown SKU is accepted. Do not query stock/reservations,
validate existence, alter availability, or write a reservation. No read or state
mutation capability is provisioned.

The host sink appends at most one observation for an observationId and returns
"stored" or "duplicate". The first accepted event wins: repeating the ID, even
with a different valid payload, returns duplicate without replacing the stored
event. The sink owns this atomic deduplication; the receiver needs no prior read
or cache. Map "stored" to
`201 { observationId, recorded: true }` and "duplicate" to
`200 { observationId, recorded: false }`.
Rejection or any other result yields
`500 { code: "storage_unavailable" }`.

Observation appends are not reservation outbox writes. The existing reservation
state and reservation.created event still belong to the same reservation commit.

### Provider B reservation deployment (B1–B6, C3, C4, C6, C7)

`createProviderBReservationService({ storage })` handles the same commands and
returns the same product responses as the legacy service. The supplied storage
has only these methods:

- `read({ collection: "inventory" | "reservations", key: string })`
- `commitBatch(batch)`

Both methods return promises and may reject. Collection plus exact key is the
lookup address; no concatenated-key escaping convention or migration is needed.

A read resolves one of:

```text
{ ok: true, value: <provider row> }
{ ok: false, error: { reason: "NO_SUCH_KEY", message?: string, requestId?: string } }
{ ok: false, error: { reason: "TEMPORARY_FAILURE", message?: string, requestId?: string } }
```

Only NO_SUCH_KEY means absent. Map it to the existing operation's 404 or the
reserve workflow's missing-reservation branch. A successful envelope with missing,
null or malformed value is unusable and returns 500. TEMPORARY_FAILURE, unknown
reason or malformed envelope also returns 500. Error message and requestId are
diagnostic provider details and must not enter public response bodies.
Only ok, value and error.reason determine the lookup outcome; unused diagnostic
and extra metadata may be ignored rather than exhaustively validated.

Inventory row:
`{ itemKey, onHandText, heldText, revisionText }`.
Reservation row:
`{ bookingKey, itemKey, unitsText }`.

itemKey and bookingKey are exact identifiers. An inventory row must match its
requested key; a reservation row's bookingKey must match its requested key.
Decimal strings use canonical nonnegative ASCII decimal syntax:
"0" or a nonzero digit followed by zero or more digits, with no sign, whitespace,
fraction, exponent or leading zeros. Decoded stock quantities have the legacy
0 through 1,000,000 bounds; reservation units have its positive bounds. The
decoded revision is a nonnegative safe integer. Reject invalid/overflowing text
and held quantities exceeding on-hand quantities with 500. Preserve exact IDs
while translating numeric fields; public quantities are numbers.

For the existing example of stock widget with on-hand 12, held 5 and revision 8,
reserving 3 for r-1 sends one atomic batch:

```json
{
  "expectedRevisionText": "8",
  "stockRow": {
    "itemKey": "widget",
    "onHandText": "12",
    "heldText": "8",
    "revisionText": "9"
  },
  "reservationRow": {
    "bookingKey": "r-1",
    "itemKey": "widget",
    "unitsText": "3"
  },
  "outboxRows": [{
    "key": "reservation.created:r-1",
    "category": "reservation",
    "name": "created",
    "payload": {
      "bookingKey": "r-1",
      "itemKey": "widget",
      "unitsText": "3"
    }
  }]
}
```

`commitBatch` compares expectedRevisionText numerically with the current stock
revision. A mismatch returns "revision_conflict" without effects; map it to
409 commit_conflict. Otherwise it atomically stages/replaces the stock row,
inserts the reservation row and appends every supplied outbox row.
It returns "applied" only after the whole batch commits. It may instead return
"unavailable" or reject, in either case committing nothing. It does not invent
omitted outbox rows. Fault fixtures return unusable outcomes before committing;
map any unknown result to 500. No observer sees staged partial effects.

The application must keep the stock update, reservation and exactly one required
reservation.created event together, use the loaded revision, and advance revision
by one. It must not append a reservation event to the standalone observation sink
before or after an independent state write. After a failed batch a later call can
retry. An exact completed reservation repeat returns the retained reservation
with no new batch or event. Data written by this adapter must work after creating
another service instance over the same provider B store.

Provider A and B remain supported independent deployments. Do not migrate legacy
records or require one provider to be present when constructing the other.

## Failure and effect observations

All public unsuccessful bodies are exactly `{ code }`; provider envelopes,
messages, request IDs and raw exceptions do not become API fields.
Ordinary domain failures, missing records, observation duplicates and unavailable
storage remain distinguishable as specified. There is no prescribed internal
error mechanism.

A grader can supply only the documented method objects, exercise normal/failing
calls, inspect complete host state and record I/O. Atomicity checks inspect stock,
reservation and outbox together after staged commit failures and successful
retries. This is not a method-count, interface-placement, file-count, library,
keyword or textual-match exercise. A broad internal adapter can be correct; a
set of single-operation types can be incorrect if it loses atomicity.

## Scope exclusions

Calls are sequential; no concurrency protocol, database isolation tuning, real
SDK/database installation, network, crash recovery, distributed transaction,
ambiguous commit acknowledgement, event broker/relay, authorization system, UI,
restock, release, expiry, clock, migration or observation-to-stock update is
requested. Revision conflict is a host outcome to map, not an instruction to
retry forever or implement locking.

Do not repair arbitrary tampered legacy records or add historical migrations.
Validate the documented new external responses and preserve self-written record
round trips. Logger exceptions and free-text DLP are not requirements.
