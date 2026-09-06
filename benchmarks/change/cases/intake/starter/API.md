# Existing order intake service API

This file describes the starting service. Implement the changes in CHANGE.md while preserving its unchanged obligations.

## Entry point and host

Export `createOrderIntake({ repository })` from `src/index.ts`. The returned object exposes asynchronous `submitOrder(value, context)`, `importOrders(value, context)` and `getOrder(id)` methods. The first two are the existing single and batch intake consumers. All return `{ status, body }` responses. Inputs are JSON values.

The repository provides:

| Method | Behavior |
| --- | --- |
| `get(id)` | Resolves to an intact canonical stored JSON order, or undefined when absent |
| `save(id, order)` | Inserts/replaces one complete canonical JSON order and resolves on success |

Both methods can reject. A rejected get leaves storage unchanged; a rejected save commits nothing and leaves the previous record unchanged. There is no lost acknowledgement after commit. Storage survives service instances. Requests and batch rows are sequential.

For each intake call the host provides `context = { receivedOn: "YYYY-MM-DD" }`. This is a trusted valid canonical date, chosen by the host and unchanged during the call. It is recorded on accepted orders. A batch has one shared context. The host supplies authentication; the service does not consult a clock.

## Version 1 input

| Field | Rule |
| --- | --- |
| `formatVersion` | Omitted or the number 1 |
| `id`, `customerId` | Each contains 1–64 ASCII letters, digits, underscores or hyphens |
| `amountCents` | Integer from 1 through 1,000,000 |
| `shipOn` | Required canonical calendar-date string |

Any other version value is invalid in the starting service. Extra fields are ignored. Recognized invalid/missing fields cannot be replaced by extra fields. IDs are preserved exactly without trimming/case normalization.

Canonical dates have the exact form YYYY-MM-DD, a year in 2000–2099, and a real Gregorian month/day. Leap years follow the Gregorian rule. There is no ordering constraint between shipOn and receivedOn. Whitespace and noncanonical spellings are invalid.

## Stored orders and success

Canonical saved JSON and successful order bodies have exactly these fields:

| Field | Value |
| --- | --- |
| `id`, `customerId` | Validated original IDs |
| `amountCents` | Validated integer cents |
| `currency` | USD |
| `shipOn` | Canonical shipping-date string |
| `receivedOn` | The host context date when the order was accepted |

No wire-version marker is stored. Existing intact records use this form.

Single intake returns status 201 with the order body after save succeeds. Reading an existing order returns status 200 with that order body. Reading never writes. A valid duplicate ID returns conflict and never saves, preserving every original field even if the newly supplied customer, amount, date or context differs.

Validate the complete intake input before any repository operation. Invalid input produces 400 with no get/save, even if its ID exists or the repository would reject.

## Errors

| Condition | Status | Body |
| --- | --- | --- |
| Invalid intake input, or invalid getOrder ID | 400 | { "code": "invalid_order" } |
| Missing order in getOrder | 404 | { "code": "order_not_found" } |
| Valid intake with duplicate ID | 409 | { "code": "duplicate_order" } |
| Repository get/save rejection | 500 | { "code": "storage_unavailable" } |
| Invalid outer batch | 400 | { "code": "invalid_batch" } |

The methods resolve to these responses for the specified failures.

## Batch import

`importOrders(value, context)` accepts an array of 0–100 elements. A non-array or longer array is an invalid outer batch and performs no repository operations. Elements may be any JSON value; invalid elements produce row errors.

For every valid outer batch, return status 200 with a body containing:

- `rows`: input-ordered entries `{ index, status, body }`, one per element, following the single intake response rules.
- `acceptedCount`: count of rows whose saves succeeded.
- `totalAcceptedCents`: integer sum of those rows' canonical cents.
- `latestShipOn`: chronologically greatest shipping-date string among those rows, or null if none succeeded.

Rows are sequential. An error does not stop later rows. An earlier successful row makes a later valid row with the same ID a duplicate. A failed save does not reserve its ID. Invalid, duplicate and unavailable rows do not enter the summary. Empty/all-failed batches have count 0, total 0 and latestShipOn null. A batch is not an all-or-nothing transaction.

## Scope

Preserve the supported toolchain and public operations. Internal design is your choice. No HTTP server, deployment, authorization implementation, payment, taxes, inventory, PII feature, storage migration, damaged-record handling, concurrency, process-crash recovery or retry protocol is required. The repository's specified no-commit-on-rejection behavior is authoritative.

