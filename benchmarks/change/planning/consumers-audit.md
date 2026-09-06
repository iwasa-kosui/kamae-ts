# Independent static audit of the consumers fixture

## Conclusion

The starter is consistent with the documented pre-change contract on the inspected paths. The reference preserves that implementation and supplies the requested report, observation receiver, and provider B deployment without an additional substantive contract defect found in this audit. The broken control has the intended single root cause: it omits the reservation outbox event from an otherwise successful atomic reservation change. That defect propagates through both reservation backends; these are two manifestations of one cause.

One low-priority wording ambiguity should be clarified before candidate runs: the C5 summary says unknown fields are invalid, while the detailed contracts explicitly ignore extra fields. The reference follows the detailed contracts. This is a specification clarification, not a reference implementation defect.

This was a read-only source audit. No implementation, tests, compiler, model, network, or Git operation was run. The only written artifact is this report. A small read-only file comparison confirmed the production-tree difference; it did not execute the implementation.

All paths below are relative to `benchmarks/change/cases/consumers/`. Line numbers refer to the inspected files.

## Coverage and preservation evidence

| Obligations | Source evidence | Assessment and discriminating source trace |
| --- | --- | --- |
| B1, B5: public entry point, exact IDs, validation before I/O | `starter/src/index.ts:1–2`; `starter/src/reservation.ts:9–23,41–45`; `starter/src/validation.ts:7–21` | The three documented commands are selected explicitly. IDs are nonempty strings without trimming; quantities are integers in the required range. For a reserve command with quantity 0 and an already-existing reservation ID, parsing returns 400 before getReservation can run. Extra fields are omitted when constructing the command. |
| B1, B4: queries, missing versus malformed data, fixed public errors | `starter/src/reservation.ts:26–38,47–69,111–112`; `starter/src/validation.ts:24–43` | Only undefined denotes absence. A present null record or a record with the wrong requested key becomes 500; a missing record becomes the operation's 404. Public success/error objects copy only documented fields. Any documented storage rejection reaches the fixed storage_unavailable response. |
| B2, B6: reservation idempotency and business failures | `starter/src/reservation.ts:63–85` | An existing exact reservation returns 200 before stock lookup; conflicting reuse returns 409 without replacement. A fresh reservation with insufficient stock returns 409 before commit. A retry after a host-guaranteed failed atomic commit rereads unchanged state and can attempt one new complete commit. |
| B3, B4, B5: complete reservation change and revision handling | `starter/src/reservation.ts:84–110`; `starter/API.md:94–112` | The next revision is checked for safe-integer validity. The loaded revision, stock increment, reservation, and exactly one matching event are supplied together. With stock total 12, reserved 5, revision 8 and quantity 3, the request carries reserved 8, revision 9, expectedRevision 8, and reservation.created:r-1. revision_conflict maps to 409; rejection or another result maps to 500. The host owns the stipulated rollback, so no separate compensating transaction is required. |
| B1–B6 retained in reference | `controls/reference/src/reservation.ts:1–116`; `controls/reference/src/validation.ts:1–44`; `controls/reference/src/types.ts:1–42`; `controls/reference/src/index.ts:1–8` | reservation.ts, validation.ts, and types.ts are byte-identical to the starter. index.ts keeps the legacy exports and adds the new ones. Existing calls and owned-record shapes remain compatible. |
| C1, C5, C6, C7: report | `controls/reference/src/stock-report.ts:5–31` | The only host operation is readSnapshot. It runs after command validation. Every snapshot row is validated, even when it would not meet the threshold; duplicate exact SKUs reject the entire snapshot. Available 3 is included below threshold 4 and excluded at threshold 3. Empty snapshots yield items: []. The comparison uses string relational operators, matching the documented UTF-16 order. Rejections and unusable snapshots become the fixed 500 body. |
| C2, C5, C7: observation receiver | `controls/reference/src/observation-receiver.ts:5–39` | Validation precedes appendObservation; the event is constructed with exactly its four required fields. Unknown SKUs need no inventory lookup. A repeated observationId with another valid payload is still submitted to the host's first-wins operation and maps duplicate to 200 recorded:false. No cache, read dependency, stock write, or reservation event is introduced. Unrecognized sink results and rejections map to 500. |
| C3, C6: provider B reads and row conversion | `controls/reference/src/provider-b.ts:41–79`; `controls/reference/src/validation.ts:11–43` | Exact collection/key lookup is retained. Only ok:false with NO_SUCH_KEY means missing. TEMPORARY_FAILURE and malformed envelopes fail. A successful null value reaches row validation and fails. Numeric text is checked against canonical ASCII decimal syntax and safe-integer bounds before the stock/reservation bounds and invariants are applied. Examples such as heldText greater than onHandText, unitsText "0", onHandText "01", and revisionText "9007199254740992" are rejected. Public quantities are decoded numbers. |
| C3, C7: provider B complete commits and round trips | `controls/reference/src/provider-b.ts:81–108,113–116`; `controls/reference/src/reservation.ts:63–110` | The facade converts the one complete reservation change into one batch, including every required event. Safe integers serialize as canonical decimal text at the supported bounds. applied becomes committed, revision_conflict remains distinct, and all other outcomes fail. A fresh instance can read the written booking/item keys and numeric strings through the same decoder, so completed retries take the existing-reservation branch without another batch. |
| C4: minimal deployment capabilities | `controls/reference/src/types.ts:29–33`; `controls/reference/src/stock-report.ts:5–9`; `controls/reference/src/observation-receiver.ts:12–16`; `controls/reference/src/provider-b.ts:32–35,113–116`; `controls/reference/src/index.ts:1–8` | Public factory parameter types require only their documented methods and are exported for typed callers. Provider B constructs an internal facade; it does not require a provisioned provider A client. A report's import of the shared error helper does not create a runtime storage requirement. |
| C7: transport details do not escape | `controls/reference/src/provider-b.ts:37–53,106–108`; `controls/reference/src/reservation.ts:26–27,111–112`; report and observation catch branches above | A read error with message/requestId is converted to absence only for the allowed reason, otherwise to a fixed failure. No envelope or exception is copied into public bodies. Suppressing raw details does not collapse the specified missing/conflict/unavailable distinctions. |

The fixture's package pins TypeScript 5.9.2 and @types/bun 1.3.0, with no runtime dependencies and the specified typecheck command (`starter/package.json:5–11`). These declarations were inspected, not installed or executed.

## Confirmed broken-control defect D1

**High severity; intended calibration defect.** The service successfully commits stock and reservation state without its required reservation.created event.

Evidence:

- `controls/broken/src/reservation.ts:98–110` supplies a valid stock/reservation change but sets `events: []` at line 106 and still returns 201 after the host reports committed.
- `controls/reference/src/reservation.ts:91–106` constructs the matching event and includes it as the sole array entry.
- `starter/API.md:98–106` explicitly says the host commits supplied events and does not invent omitted ones.
- `controls/broken/src/provider-b.ts:95–104` maps the empty event list to empty outboxRows, and `CHANGE.md:186–200` assigns responsibility for the required event to the application.
- `controls/control.json:12–30` describes this same defect and a one-line production-tree difference. Direct comparison independently confirmed that reservation.ts line 106 is the only source difference between reference and broken; both implementation notes are identical.

Concrete counterexample, without executing it:

1. The host has stock `{sku:"widget",totalUnits:12,reservedUnits:5,revision:8}` and no r-1 reservation or matching outbox event.
2. Handle `{op:"reserve",reservationId:"r-1",sku:"widget",quantity:3}`.
3. Reads return that state and the atomic commit succeeds.
4. The broken service returns 201 and the host retains stock reservedUnits 8/revision 9 and the r-1 reservation, but retains no reservation.created:r-1 event.
5. The required result includes exactly that matching event in the same atomic change.

The provider B counterexample uses the equivalent decimal-string rows and an applied batch result. Its outboxRows is empty for the same reason. A later exact retry returns the stored reservation at lines 71–74 and does not repair the missing event. Missing delivery on either backend and the inability of an ordinary completed retry to repair it are consequences of the same omission, not additional independent defects.

No second implementation root cause was found. In particular, the retained unused local event declaration in the broken file is not a second behavioral defect. The supplied compiler settings do not require removing unused locals.

Minimal correction: restore `events: [event]` in the existing atomic request. No change to the provider B batch mapping, observation sink, or host transaction model is needed.

## Specification clarification A1

**Low priority; affects prompt clarity, not the reference's behavior.**

The C5 summary in `CHANGE.md:28` and `case.json:44–47` says "Unknown/missing/invalid fields return 400". Read literally, this includes unknown extra keys. The detailed report contract says extra command fields are ignored (`CHANGE.md:55–58`), and the observation contract says extra fields are ignored and never enter the event (`CHANGE.md:79–82`).

A concrete ambiguous input is `{op:"lowStock",belowUnits:4,traceId:"x"}`. Under the detailed contract it is valid and must read the source; under the literal summary wording its unknown traceId field could imply a 400. Similarly, an observation with an extra transport field is valid but must not forward that field.

Both controls implement the detailed interpretation: report validation checks only required values (`controls/reference/src/stock-report.ts:12–16`), and observation construction selects only the required event fields (`controls/reference/src/observation-receiver.ts:19–28`). This should not be marked as a code defect.

Suggested wording in both summaries: "Unknown ops and missing/invalid required fields return 400 invalid_command; extra fields are ignored and do not enter observation payloads." Clarifying this before runs avoids awarding different judgments for two readings of the same instruction.

## Design neutrality and limits

No unnecessary obligation requiring a particular internal design was found. The host-method restrictions are concrete deployment constraints: only a snapshot source exists for the report, only an append sink exists for observations, and provider B has its own protocol. `CHANGE.md:44–51` explicitly allows internal sharing and larger internal objects while preserving the caller's actual obligations. `CHANGE.md:214–219` rejects interface-count, file-placement, library, and textual-match grading. A direct implementation, facade, injected functions, or another internal organization can satisfy the same effects and public contracts.

Atomicity is also a behavioral preservation obligation, not an architecture keyword. The host supplies an atomic operation and does not synthesize application events. Requiring the service to submit its event in that same operation is supported by the baseline contract; requesting an additional transaction coordinator or independent event append would add an excluded burden.

The scope explicitly excludes concurrency, ambiguous commit acknowledgements, crash recovery, migration, and unrelated real infrastructure (`CHANGE.md:221–232`; `starter/API.md:114–122`). This audit did not invent requirements in those areas. It also did not treat arbitrary public IDs as protected data requiring free-text scanning.

The assessment is supported by static source traces, not executed type compatibility or behavior checks. No claim of exhaustive runtime verification is made. The identified wording ambiguity is the only requested clarification; the observed code distinction is appropriate for a one-defect calibration pair.

## Files read

All production source was read in full:

- `starter/src/index.ts`, `starter/src/types.ts`, `starter/src/validation.ts`, `starter/src/reservation.ts`.
- `controls/reference/src/index.ts`, `types.ts`, `validation.ts`, `reservation.ts`, `provider-b.ts`, `stock-report.ts`, `observation-receiver.ts`.
- `controls/broken/src/index.ts`, `types.ts`, `validation.ts`, `reservation.ts`, `provider-b.ts`, `stock-report.ts`, `observation-receiver.ts`.

Also read: `CHANGE.md`, `case.json`, `starter/API.md`, `starter/package.json`, `starter/tsconfig.json`, both `controls/*/IMPLEMENTATION.md`, and `controls/control.json`. No other candidate source, release label, skill file, or benchmark result was used.
