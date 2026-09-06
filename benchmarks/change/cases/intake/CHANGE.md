# Add the partner's version 2 order format

The service already supports the single-order portal and batch import described in starter/API.md (copied to API.md in the working project). Implement version 2 intake for a partner exporting decimal amounts and calendar-date components. Keep both existing consumers and stored orders compatible. This is a modification of the supplied service, not a request to redesign unrelated functionality.

## Unchanged obligations

- **B1 — Version 1 remains valid.** Keep its existing ID, cents and required date validation, optional numeric formatVersion 1, ignored extras and lack of trimming/coercion.
- **B2 — Records and order bodies remain stable.** Keep exactly id, customerId, amountCents, currency USD, shipOn and receivedOn, using the same public field types. Internal types and representations may change. Existing intact records survive service instances, read unchanged and are not rewritten on reads or conflicts.
- **B3 — Public operations and responses remain stable.** Preserve the factory, methods, success statuses and documented error status/code pairs.
- **B4 — Validation precedes storage; duplicates preserve originals.** Invalid input performs no repository operation. Valid duplicates report conflict without a save across rows/calls/service instances.
- **B5 — Batch summaries count completed successes.** Preserve arrays of 0–100 rows, outer validation before effects, input-ordered row responses, status 200 for valid batches, and acceptedCount/totalAcceptedCents/latestShipOn computed only from successfully saved canonical orders.
- **B6 — Dependency failures stay contained per row.** Rejections produce 500. A failed save commits nothing, does not count as accepted and does not reserve an ID. Later batch rows continue sequentially. Keep the host's receivedOn date.

The detailed starting API remains authoritative where this change does not extend it.

## New requirements

### C1 — Select the format explicitly

Accept numeric formatVersion 2 through both single intake and batch rows. Omitted formatVersion still means version 1; numeric 1 retains version 1 behavior. Other values, including strings, null and 3, are invalid.

Use the selected version's recognized fields; do not infer versions from shapes or fall back after validation failure. Extra fields may be ignored, but a valid legacy amountCents cannot rescue a version 2 value whose required new amount is missing or invalid.

### C2 — Normalize decimal money exactly

Version 2 replaces amountCents with required amount, an object containing required decimal text.

The decimal is a string with an unsigned integer part, optionally followed by a decimal point and one or two fractional digits. Its integer part is 0 or starts with a nonzero digit; no other leading zeroes are allowed. Reject whitespace, signs, exponents, commas, an empty fraction, excess fraction digits and nonstrings. Convert exactly to integer cents within 1–1,000,000. Do not round or clamp.

Examples: "1", "1.2", "1.20" and "1.15" yield 100, 120, 120 and 115 cents. "0.01" and "10000.00" are valid boundaries. "10000.01", "0", "1.005", "1e2", "01.20", "+1", ".50", "1." and numeric 1.20 are invalid.

### C3 — Default currency only on omission

Version 2 amount.currency is optional and defaults to USD. If present, it must be exactly the string USD. Null, an empty string, lowercase usd and other currencies are invalid. Extra fields in amount may be ignored. This is not currency conversion.

### C4 — Normalize a real calendar date

A present version 2 shipOn is an object with required integer year, month and day. It must represent a real Gregorian calendar date in 2000–2099. Convert it to the old zero-padded YYYY-MM-DD string. Invalid dates must not overflow into a different month; machine time zones must not alter the date.

Null, strings, missing components and wrong component types are invalid. Extra date fields may be ignored. There is no ordering restriction relative to receivedOn.

### C5 — Default only an omitted new date

If the entire version 2 shipOn property is omitted, use this call's trusted context.receivedOn. A batch shares that one context. Do not read a clock. Do not default invalid present values. Version 1 shipOn remains required and receives no new default.

### C6 — Complete the change through both consumers

Single intake and mixed-version batches use identical format/normalization/default rules. Save, response and summary operations must receive integer cents and canonical dates, including when defaults apply. Retain ordered partial-success behavior and count only completed saves.

A batch must not sum decimal strings or major units, compare date objects, include failed/duplicate rows, or count a save before success.

### C7 — Keep wire changes out of canonical records

Version 2 produces exactly the same canonical saved and public order fields as version 1. Do not persist/expose the amount object, date object or formatVersion. Existing records remain readable and block duplicates from either version. No migration, new storage marker or incidental rewrite is requested.

## Concrete example

With empty storage and context receivedOn "2028-02-29", importing the following rows in order produces statuses 201, 201, 400, 409 and 201:

| Row | Fields in addition to valid IDs/customer IDs | ID |
| --- | --- | --- |
| 0 | formatVersion 1; amountCents 1250; shipOn "2028-03-02" | OLD |
| 1 | formatVersion 2; amount { decimal: "1.15" }; shipOn omitted | NEW |
| 2 | formatVersion 2; amount { decimal: "5.00" }; shipOn { year: 2028, month: 2, day: 30 } | BAD |
| 3 | formatVersion 2; amount { decimal: "2.00" }; shipOn { year: 2028, month: 4, day: 1 } | OLD |
| 4 | formatVersion 2; amount { decimal: "0.01" }; shipOn { year: 2028, month: 3, day: 1 } | LAST |

acceptedCount is 3, totalAcceptedCents is 1366 and latestShipOn is "2028-03-02". Only rows 0, 1 and 4 are saved, in the old canonical format; row 3 preserves row 0.

## Delivery and scope

Modify production code and explain the change and any consequential tradeoffs in IMPLEMENTATION.md. Preserve working public consumers and the supported toolchain. Internal types, runtime validation, error representation and organization are choices; no pattern, library API or file-count target is required.

Apply only the documented task and host semantics. No migration, damaged storage/context repair, clock, time zone, concurrency, process-crash recovery, unknown commit outcome, retry policy or all-or-nothing batch transaction is required.

