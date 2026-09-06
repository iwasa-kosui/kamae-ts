# Independent static audit: recovery change case

## Outcome and method

The starter is consistent with its pre-change shipping contract. The reference is consistent with B1–B4 and C1–C7 under the documented host and dependency assumptions. The broken control has one confirmed root cause: unrecognized carrier rejections become fabricated permanent refusals. No unintended additional defect was identified in the starter, reference, or shared control code.

This was a read-only source audit. No implementation, test, type checker, package installer, model, network request or Git operation was run. A read-only directory diff confirms that the two control trees differ only at `src/index.ts:227`; their implementation notes are identical. The private control metadata was checked against the source and does not establish correctness by itself. No final score is assigned.

Paths below are relative to `benchmarks/change/cases/recovery/`. All fixture files were read: `case.json`, `CHANGE.md`, `starter/API.md`, `starter/package.json`, `starter/tsconfig.json`, `starter/src/index.ts`, both controls' complete `src/index.ts` and `IMPLEMENTATION.md`, and `controls/control.json`.

## Starter and preserved obligations

| Obligation | Starter evidence and reference preservation |
| --- | --- |
| B1: API, complete command validation, invalid and missing responses | `starter/src/index.ts:65–94` validates the operation, nonempty ID, safe nonnegative dispatch time, and both nonblank recipient strings, while preserving their original values. `handle` parses before repository access at lines 114–128. Get requires only its own fields. The reference retains those rules at `controls/reference/src/index.ts:116–145,323–336`. Both implementations accept nonempty whitespace-only IDs as expressly allowed by `starter/API.md:14`. |
| B2: historical JSON and immutable public fields | The starter's queued/dispatched records are plain JSON-compatible data at `starter/src/index.ts:27–48,160–169`; `publicShipment` explicitly projects public fields at lines 96–112. Reference `storedFields` and `publicShipment` at lines 151–191 preserve id, routeCode and parcelGrams, omit recipient and schemaVersion publicly, and handle all four states. Historical schemaVersion 1 queued and Atlas-dispatched records need no new field or runtime identity. |
| B3: Atlas-first dispatch, commit order and idempotent reads | `starter/src/index.ts:133–180` returns saved dispatched values without additional effects, otherwise calls Atlas, validates its nonempty bookingId, constructs the decision with command.nowMs, awaits save, then logs and returns. Reference `handle` at lines 341–364 starts queued work with Atlas, and `commit` at lines 289–303 retains save-before-log-before-response ordering. |
| B4: exact requests and host time | Starter `index.ts:139–148` and reference `index.ts:261–275` explicitly construct the required request fields, exact recipient strings, and shipment-ID idempotency key. Reference deadline comparisons and persisted dispatch times use command.nowMs at lines 277,347,363. No clock or automatic scheduler appears. |

The starter's generic 500 body and lack of abort diagnostics are correct before the change: `starter/API.md:62` permits the new request to replace that body, and the new contextual diagnostics are C5/C6 obligations. Starter provider failures and unusable confirmations return without save at `starter/src/index.ts:137–157`; repository read and write failures are contained at lines 121–126 and 170–174. Its logger call occurs only after a successful save. The new Beacon and deferred/unavailable behavior is correctly absent from the starting implementation.

## Reference coverage of the new obligations

All source references in this table are to `controls/reference/src/index.ts`.

| Obligation | Evidence and assessment |
| --- | --- |
| C1: definitive refusal authorizes fallback; ordered reasons; terminal unavailability | Lines 202–227 classify only each carrier's documented structured refusal format with an allowed reason. Lines 373–383 append exact carrier/reason pairs; Atlas refusal switches once to Beacon, while Beacon refusal returns the unavailable commit. Confirmation extraction at lines 283–286 normalizes Beacon reference to bookingId. Terminal unavailable dispatch returns 422 at lines 344–345. There is no loop path that attempts the same eligible carrier twice in one invocation. |
| C2: precise deferral and no throttle fallback | `isFutureDeadline` at lines 198–200 requires a safe integer strictly greater than the supplied nowMs. Classifier lines 209–224 return either a valid deadline or invalid outcome. The rate-limit branch at lines 365–372 immediately returns a commit containing the selected provider, exact deadline and copied established refusals; it never moves to the next carrier. |
| C3: durable plan and due resumption | Deferred storage fields are ordinary provider strings, number and refusal objects at lines 56–61. Lines 347–352 return early before the deadline or reconstruct the selected provider and refusal context from the loaded record. Repeated throttling replaces the deadline at lines 365–372 while retaining the copied context. No instance-local cache, class instance, symbol, or object identity is needed. |
| C4: distinguish unknown failure, malformed signal and unusable confirmation | Carrier-specific known signals are decoded at lines 202–227. Unknown values remain unknown; recognized signals with invalid fields become invalid. The await/catch at lines 272–278 distinguishes rejections from resolved confirmations, which are validated separately at lines 280–286. Lines 384–387 return an abort directly with the attempted carrier and accumulated refusals, without commit or additional carrier call. |
| C5: repository failure stays a repository failure | Read rejection goes directly to `abort(..., "repository", "repository_failure", [])` at lines 329–334 before any provider call. `commit` awaits save at lines 289–294 and returns an abort on rejection before reaching any committed event. Provider-looking rejected repository values are never passed to the carrier classifier. Each commit caller passes the current established refusals, including refusals preceding a successful booking. |
| C6: exactly one contextual allowlisted event | Abort builds one event at lines 237–243 and one matching body at lines 244–253. Committed events at lines 296–319 are state-specific and occur only after successful save. Read rejection, including get, reaches the same abort helper at line 333. Invalid/missing responses and successful/terminal/early-deferred reads exit at lines 324–348 without an event. Carrier and reason remain separate enum fields, independent of message text. |
| C7: recipient data does not enter persistence, responses or diagnostics | Parsing retains only recipient name and postalAddress in transient command data at lines 136–143; the only outgoing recipient projection is the carrier request at lines 261–270. `storedFields`, decision constructors, `publicShipment`, `copyRejections`, abort and committed events explicitly select allowed fields at lines 147–191,237–253,296–319,357–383. No raw command, request, response, rejected value or Error metadata is forwarded to a prohibited surface. |

## Focused state, failure and privacy traces

The following are source-derived traces, not executed tests.

### JSON reload and Beacon plan continuity

Start with the API's queued record, dispatch at nowMs 1000, let Atlas reject `{ code: "cannot_ship", reason: "unsupported_route" }`, then let Beacon reject `{ type: "throttled", details: { retryAtMs: 1700 } }`.

The reference constructs and saves a schemaVersion 1 deferred record with the immutable fields, `nextProvider: "beacon"`, `retryAtMs: 1700`, and `rejections: [{ provider: "atlas", reason: "unsupported_route" }]`. It emits exactly one deferred event and returns 202. These values are strings, finite numbers, arrays and plain objects, so a JSON round trip retains every value needed by `handle` (`index.ts:351–352`).

A reconstructed service returns the saved body with no provider/write/log for dispatch at 1699. Get at any time returns that body with status 200 and no resumption. Dispatch at exactly 1700 calls only Beacon. A Beacon refusal then produces unavailable with Atlas's prior refusal followed by Beacon's actual refusal; a later Beacon throttle preserves Atlas's reason and the selected carrier while replacing only the deadline. This meets `CHANGE.md:33,81–83,102` without relying on an in-memory refusal history.

An Atlas deferred plan has no prior refusal; due Atlas can refuse and authorize Beacon within that invocation. A saved unavailable plan is terminal for dispatch, while get still returns 200. The ordering of the get check before unavailable handling at `index.ts:341–345` implements that distinction.

### Established but uncommitted refusals

For queued → Atlas refusal → Beacon confirmation → rejected save, `handle` retains the Atlas refusal separately from the dispatched decision and passes it to `commit` (`index.ts:357–364,373–377`). The resulting response and sole event identify repository failure and retain that refusal (`index.ts:289–294,231–253`). No success event or later carrier call occurs, and the host's rejected-save guarantee keeps the queued record intact.

A later explicit dispatch can therefore call Atlas again from that queued record. This is expressly permitted by `CHANGE.md:104`: only refusals retained in the current invocation or successfully saved plan suppress attempts. Treating an uncommitted refusal as a permanently remembered cross-invocation requirement would contradict the supplied contract. The same principle applies when Beacon's unknown outcome aborts before any plan is saved.

For an already saved Beacon-deferred plan, an unknown Beacon outcome or a failed save leaves the prior plan intact. A later explicit due dispatch calls Beacon again using the original key and still suppresses Atlas using the saved refusal. On a second-refusal unavailable decision whose save rejects, the abort preserves both current established refusals, while the old deferred record retains only what was previously committed. The implementation does not mutate that loaded record: the current list is copied at line 352 and append creates a new array at line 374.

### Read failures and diagnostic obligations

For either `{ op: "get", shipmentId: "shipment-1" }` or a valid dispatch, let repository.get reject an Atlas-shaped value such as `{ code: "rate_limited", retryAtMs: 1700 }`. The reference returns 500 with exactly `code: "dispatch_aborted"`, the command shipmentId, `failedAt: "repository"`, `classification: "repository_failure"`, and `rejections: []`; it emits exactly one matching aborted event. No record was read, so an empty list is correct even if storage internally contained a deferred plan. The read rejection cannot enter `classifyRejection` (`index.ts:329–334`).

A successful get is silent, and a missing record returns 404 silently. This distinction is explicit in `CHANGE.md:45,100,119`, so a blanket rule forbidding logs on every get command would be an incorrect interpretation.

### Carrier classifications and metadata

An Atlas rejection with code cannot_ship and reason unsupported_route remains a refusal even if message says rate limited. A Beacon-formatted rejection received from Atlas is unknown rather than decoded using Beacon's fields. Equal, past, fractional, string or non-finite throttle deadlines produce invalid_provider_response, without fallback or write. A resolved refusal-shaped object without the appropriate confirmation identifier is likewise invalid; a resolved object with a valid bookingId/reference is a confirmation even when extra metadata resembles a failure signal (`index.ts:202–227,272–286`).

For example, after a genuine Atlas refusal, a Beacon Error whose message embeds the command's exact recipient must produce an abort with only the carrier, classification, and earlier allowed refusal. In the reference the cause is inspected only for documented signal fields, and neither that Error nor the request reaches the response, repository or event. Provider success metadata and repository rejected values have the same exclusion. The booking identifiers, shipment IDs, routes and enum reasons are contractually independent non-PII values (`CHANGE.md:53,142`); content scanning or treating coincidental equality as direct recipient propagation would create an unsupported privacy requirement.

## Confirmed finding: broken fabricates permanent refusals from unknown outcomes

**REC-1 — High severity; primarily C4 and C1; high confidence.** At `controls/broken/src/index.ts:227`, the final classifier outcome is `{ kind: "refused", reason: "unsupported_route" }` instead of the reference's `{ kind: "unknown" }`. Every otherwise unrecognized carrier rejection can therefore invent a refusal and enter the recovery path.

- Call path: `handle` → `attempt` catch → `classifyRejection` default → `handle` refused branch (`controls/broken/src/index.ts:272–277,373–383`).
- Permitted counterexample: the queued shipment from `starter/API.md:25`, valid dispatch at nowMs 1000 with recipient Avery Example / 14 Example Avenue, Atlas rejecting `Error("Unknown booking outcome for Avery Example")`, Beacon ready to confirm `{ reference: "beacon-1" }`, and a successful repository save.
- Required behavior: Atlas is the only carrier called; preserve the queued record; emit one sanitized aborted event and return 500 with failedAt atlas, unknown_failure and an empty rejection list (`CHANGE.md:37,66`).
- Actual behavior from the broken source: fabricate Atlas/unsupported_route, call Beacon, save a Beacon-dispatched record, emit a dispatched event and return 200. Atlas's outcome may already involve a booking, and the contract has no cross-carrier idempotency.
- Additional manifestation: following a genuine Atlas refusal, an unknown Beacon rejection becomes an invented second refusal and a persisted 422 unavailable decision. If the subsequent decision save rejects, its abort carries a fabricated refusal. These are consequences of the same classifier fallback, not additional independent root causes.
- Minimal correction: restore the unknown outcome at line 227. This preserves the existing abort branch, which already reports the attempted carrier and established context safely.
- Regression obligations: unknown Error/string/null/object rejections from either carrier abort without fallback or decision save; preserve genuine earlier refusals; keep known refusal and throttle behavior; retain invalid_provider_response for malformed known signals and unusable confirmations; keep repository failures outside carrier classification.

The wrong committed decision also changes which diagnostic event is emitted and what rejection history downstream surfaces contain. Those are causal consequences of REC-1; they should not be scored as separate root causes. The one-line change does not directly add a PII leak. The rest of the source, including storage representation, resume gating, malformed-known-signal handling, commit ordering, read-failure diagnostics and recipient projections, is identical to the reference. The private metadata's expected counterexample and single-root-cause description at `controls/control.json:13–71` agree with the independent trace.

## Contract clarity and grading neutrality

No blocking ambiguity or style-dependent requirement was found. The difficult boundaries are explicitly settled: successful versus failed reads, saved versus uncommitted refusals, prior-plan survival after abort, exact deadline equality, carrier-specific rejection formats, no cross-carrier idempotency, and non-PII public identifiers. The implementation's plain JSON records satisfy persistence continuity without being required to retain a particular private schema for new states.

Use the documented host-created and service-produced record set when assessing reads. The type assertion at `controls/reference/src/index.ts:340` is not by itself a defect: arbitrary corrupt or foreign storage is excluded by `starter/API.md:36` and `CHANGE.md:146–148`. Similarly, do not require a separate persistence of each refusal before attempting Beacon, a global refusal ledger across failed commits, compensation for a confirmed but unsaved booking, an abort saved as a terminal state, or logger exception guarantees.

`CHANGE.md:150` permits different error, validation, state and module designs. A loop, explicit transition functions, a discriminated union, or another representation can be assessed from the same allowed effect traces. File count, exception-vs-result style, branded types, classifier placement and resemblance to the reference provide no independent correctness evidence. This audit found the task and controls suitable for static calibration, subject to the separately authorized toolchain validation.
