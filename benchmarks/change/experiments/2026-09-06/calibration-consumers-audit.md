# Independent audit of consumers calibration

## Scope and conclusion

The first review below covers K002 and independently checks the packaged before/after production source, final adjudication, combined critic findings, frozen consumers control metadata, and the packaged product contracts. K006 was inspected subsequently; the K006 correct-control addendum at the end records that review and the paired calibration recommendation.

The K002 judgment is supported. The expected missing reservation event is detected, the proposed correction is minimal and sufficient for the inspected defect, and the adjudicator retains exactly one root cause. B3, B5, C3, and C7 are the appropriate affected requirements. No false-positive finding or additional necessary implementation correction was found in K002.

These are static source conclusions, not executed test results. No implementation, tests, compiler, network, model, Git operation, or protocol edit was performed. This report is the only written file. Reading/comparing source bytes and parsing review JSON were used only to inspect the supplied artifacts.

Paths are relative to `benchmarks/results/change-v1.0-v1.4-20260906/`. For shorter source references, `package/` below means `calibration/K002/package/`.

## Input and retained-finding integrity

All eleven production source files were read in full: four before files and seven after files. The seven after files are byte-identical to the frozen `control-inputs/consumers/broken/src/` files. Thus the adjudication is being checked against the intended frozen defective input, not an inferred candidate label.

The frozen control describes one omission: changing the existing commit's `events: [event]` to `events: []`, with the same effect on the provider B batch (`control-inputs/consumers/control.json:12–30`). Its prediction matches the actual source:

- `package/before/src/reservation.ts:91–107` constructs and submits the matching event.
- `package/after/src/reservation.ts:91–107` still constructs the event but submits the empty array at line 106.
- `package/after/src/provider-b.ts:95–104` maps only supplied events into outboxRows.
- `package/after/src/provider-b.ts:113–117` routes provider B through that same reservation workflow.
- `package/DIFF.patch:18–26` records the event-array regression.

The combined artifact contains two reports of this cause: A_F1 and B_F1 (`calibration/K002/combined.json:2–97`). The final artifact retains only A_F1 (`calibration/K002/final.json:394–448`), accepts it, and marks B_F1 as its duplicate (`final.json:588–628`). Two critics and two affected backends do not create additional root causes.

## Counterexample verification

The final counterexample (`calibration/K002/final.json:433`) is permitted and reaches the defective branch. Its commit-success condition can be made explicit as follows; this expands the static trace without changing the finding.

For legacy storage:

1. The host retains stock `{sku:"widget",totalUnits:12,reservedUnits:5,revision:8}`, with no r-1 reservation or reservation.created:r-1 event.
2. Handle `{op:"reserve",reservationId:"r-1",sku:"widget",quantity:3}`.
3. getReservation returns undefined, getStock returns that stock, and commitReservation resolves "committed".
4. Parsing succeeds before I/O. The missing reservation, sufficient availability, and safe next revision permit the commit (`package/after/src/reservation.ts:9–23,63–85`).
5. The service submits expectedRevision 8, reservedUnits 8, revision 9, and the r-1/widget/3 reservation, but `events: []`. It then returns 201 (`reservation.ts:98–110`).
6. The host commits the supplied stock and reservation but no event. This is expressly allowed by the infrastructure contract: it does not invent omitted events (`package/API.md:98–106`).

For provider B, read of reservations/r-1 returns `{ok:false,error:{reason:"NO_SUCH_KEY"}}`; inventory/widget returns `{ok:true,value:{itemKey:"widget",onHandText:"12",heldText:"5",revisionText:"8"}}`; commitBatch resolves "applied". The adapter supplies the corresponding updated decimal-string rows but `outboxRows: []` (`package/after/src/provider-b.ts:58–108`). The host appends only the supplied outbox rows, so the outcome again lacks the required event (`package/CHANGE.md:186–201`).

Required behavior on either backend is the same: the successful reservation change includes exactly one matching reservation.created event in the same atomic operation. The recorded result instead omits an entire mandatory business effect.

The final wording about incomplete stock/reservation/event atomicity is valid as a description of that required business change. It should not be read as evidence that the host transaction itself exposes partially staged writes: the empty application batch still commits atomically under the host guarantee. The defect is incomplete batch contents, not a defective database transaction protocol.

## Minimal correction

The final correction at `calibration/K002/final.json:437` is sufficient: submit `events: [event]` at `package/after/src/reservation.ts:106`.

This reuses the already-correct event construction at lines 91–97 and restores the existing baseline behavior. Provider B then automatically produces one matching outbox row through its existing mapper at `provider-b.ts:95–104`. No separate provider B fix, observation-sink append, new host method, transaction coordinator, or event-relay mechanism is necessary.

It also preserves the relevant failure and repeat behavior:

- Commit rejection, unusable outcome, and revision conflict retain their existing fixed-code responses (`reservation.ts:108–112`; `provider-b.ts:106–108`).
- The host's failed atomic commit retains no stock/reservation/event effect (`API.md:98–112`; `CHANGE.md:186–193`).
- An exact completed retry returns before stock lookup and commit, so restoring the event to a successful new reservation does not add another event on that retry (`reservation.ts:63–75`).
- A fresh instance reads the same JSON records, preserving the completed-reservation branch.

These are regression obligations supported by the source and contract, not newly executed checks. Repairing historical omissions is not part of this minimal correction; migration and arbitrary historical repair are excluded by the frozen contract.

## Affected requirements and count

The final finding enumerates B3, B5, C3, and C7 (`calibration/K002/final.json:397–401`). Both critics list the same IDs. This is neither underinclusive nor an unjustified expansion of the inspected cause.

| Requirement | Why correction is necessary | Contract evidence |
| --- | --- | --- |
| B3 | A successful new reservation must include exactly one matching event in the complete atomic change. The supplied events list is empty. | `package/CHANGE.md:14`; `package/API.md:98–106` |
| B5 | Required reservation event data is not retained at all. Exact stock/reservation IDs and JSON round trips do not satisfy the missing event-data obligation. | `package/CHANGE.md:16` |
| C3 | The new provider B deployment must retain existing reservation behavior and its documented batch contents. It inherits the shared event omission. | `package/CHANGE.md:26,156–201` |
| C7 | Provider B must preserve the full reservation business change, including the event, in its atomic batch. Correct rejection and revision-conflict mapping does not cure missing success-path outbox contents. | `package/CHANGE.md:30,186–201` |

The final `correction_needed` status for each of those four requirements consistently cites the same retained A_F1. The final overall outcome is therefore appropriate under the rubric (`package/RUBRIC.md:41–46,57–66`; `calibration/K002/final.json:587`).

The remaining supported requirements do not need to be marked defective merely because the finding affects the service as a whole:

- B1 concerns the preserved callable command/response/validation surface; those branches and exports remain intact.
- B2's stock checks, exact-repeat behavior, and conflicting-ID behavior remain intact.
- B4's unusable-record, revision-exhaustion, and dependency failure mappings remain intact.
- B6's non-committing read/business-failure/repeat branches and no-duplicate retry obligation do not themselves require a second correction. Event absence on an otherwise successful reservation is already captured by B3/B5.
- C1 and C2 are independent report/observation workflows and do not use the defective reservation commit.
- C4's minimal provisioned dependencies are satisfied by the actual public factory parameter types.
- C5's validation and extra-field handling remain correct. The frozen wording at `package/CHANGE.md:28` explicitly says unknown operations and invalid required fields, so the earlier possible "unknown fields" reading is not present here.
- C6's report validation and provider B envelope/key/decimal conversion remain implemented independently of the omitted event.

Useful source counterevidence for those judgments is `package/after/src/index.ts:1–8`, `types.ts:29–33`, `validation.ts:7–43`, `reservation.ts:9–85,108–112`, `stock-report.ts:5–31`, `observation-receiver.ts:12–39`, and `provider-b.ts:32–79,106–117`.

The count is one necessary root-cause correction, affecting four mandatory statements. The four statements are coverage information, not four independent defects or four equal deductions. The rubric explicitly requires this treatment (`package/RUBRIC.md:41–43`; `package/CHANGE.md:19–20`).

## False positives, impact, and calibration limits

No unsupported finding is present in either combined critic report or the retained final report. A_F1 and B_F1 are both true-positive descriptions of the same missing event. The final merge is correct. No false negative beyond that known cause was established by independently reading the package source.

The final `kind: "both"` is supported: the omitted event regresses an existing legacy behavior and prevents the new provider B path from providing the same required behavior. The `blocked_required_outcome` impact is also supported because these newly accepted reservations have no submitted event for downstream outbox consumers. Neither label implies a numeric quality score.

No architectural false positive was introduced for the combined legacy interface, provider B facade, shared error helper, exceptions, or file layout. These satisfy the actual dependency and effect constraints and do not require correction merely for their form.

K002 shows detection and correct deduplication of this seeded substantive defect. It does not, by itself, establish a general false-positive rate, evaluator specificity on correct implementations, or comparative release quality. At the time this K002 section was completed, K006 had not been inspected; its subsequent assessment is recorded in the addendum below.

## Inspected artifacts

Read in full: `package/before/src/{index,reservation,types,validation}.ts` and `package/after/src/{index,reservation,types,validation,stock-report,observation-receiver,provider-b}.ts`; `package/API.md`; `package/CHANGE.md`; `package/RUBRIC.md`; `package/IMPLEMENTATION.md`; `package/DIFF.patch`.

Reviewed `calibration/K002/final.json`, both critic findings and both sets of requirement judgments in `calibration/K002/combined.json`, and `control-inputs/consumers/control.json`. The seven frozen broken source files were also read as bytes to verify package identity. No reviewer tool logs or another calibration package were used during that first review.

## K006 correct-control addendum

### Scope, identity, and judgment

K006 has now been independently inspected after completion. Its final `supported` outcome is justified under the frozen source-review rubric. All thirteen B/C requirements are marked supported, findings is empty, and decisions is empty (`calibration/K006/final.json:16–446,561–566`). No necessary correction or false-positive finding was found in this review.

All eleven K006 before/after source files were read in full, together with API.md, CHANGE.md, RUBRIC.md, IMPLEMENTATION.md, and DIFF.patch. The K006 after source tree and `control-inputs/consumers/reference/src/` have exactly the same seven-file set, and every file is byte-identical. This was a direct file-content comparison, not reliance on the word "reference" in metadata.

K006's API.md, CHANGE.md, and RUBRIC.md are byte-identical to the already-inspected K002 contracts. Within K006, reservation.ts, types.ts, and validation.ts are unchanged from before to after; the actual diff adds the requested exports and three new consumer/adapter files. Between K002 and K006 after production trees, the only difference is `reservation.ts:106`: K006 includes `events: [event]`. This is exactly the minimal correction independently validated for K002.

All source references in the remainder of this addendum are relative to `calibration/K006/package/`.

### Requirement support

| Obligations | Independent source basis | Assessment |
| --- | --- | --- |
| B1 | `after/src/index.ts:1–2`; `reservation.ts:9–23,43–82` | Legacy exports, three operations, exact public response shapes, ignored extras, and validation before any storage operation remain intact. |
| B2 | `after/src/reservation.ts:63–83` | Exact existing reservation repeats return 200 before stock lookup; conflicting payloads return 409. New reservations require existing stock and sufficient availability. |
| B3 | `after/src/reservation.ts:84–110` | The same atomic request carries loaded expectedRevision, the stock increment, revision plus one, the reservation, and exactly one correctly constructed event. 201 follows only a committed outcome. |
| B4 | `after/src/validation.ts:20–43`; `reservation.ts:26–27,49–51,64–66,84–85,108–112` | Malformed or mismatched present records, exhausted revision, rejected storage calls, and unusable results are contained as fixed-code 500 responses. revision_conflict remains a 409. |
| B5 | `after/src/validation.ts:7–17`; `reservation.ts:30–38,86–107`; `provider-b.ts:58–104` | Exact identifiers and required numeric/event fields are explicitly projected. The complete event is now included. JSON data and ordinary storage reads support fresh instances, including provider B numeric-text round trips. |
| B6 | `after/src/reservation.ts:43–85,98–112`; `API.md:98–112` | Reads, invalid input, domain failures, and completed repeats perform no commit. Event inclusion occurs only inside the host's atomic request; a failed request leaves no event to duplicate on retry. |
| C1 | `after/src/stock-report.ts:5–31` | Only readSnapshot is provisioned/used; the complete snapshot is validated, duplicate exact SKUs fail, filtering is strictly below the threshold, and sorting is the specified string relational order. Empty results remain items: []. |
| C2 | `after/src/observation-receiver.ts:12–39`; `CHANGE.md:95–108` | The receiver performs no inventory query, constructs only the documented event fields, accepts unknown SKUs, and delegates first-wins deduplication to the host. stored/duplicate map to the required 201/200 bodies. |
| C3 | `after/src/provider-b.ts:32–35,41–117`; `reservation.ts:91–107` | The provider B factory needs only read/commitBatch, translates envelopes and decimal rows, reuses the correct reservation behavior, and now submits the required outbox row with its stock and reservation rows. |
| C4 | `after/src/index.ts:1–8`; `types.ts:29–33`; `stock-report.ts:5–9`; `observation-receiver.ts:12–16`; `provider-b.ts:32–35,113–117` | Each public dependency type requires only the documented host capabilities. The internal legacy facade does not require a provisioned provider A client. Shared code imports do not create additional host initialization obligations. |
| C5 | `after/src/validation.ts:7–17`; `stock-report.ts:12–16`; `observation-receiver.ts:19–30` | Required IDs/ranges/operations are checked before I/O. Extras are ignored and cannot enter the observation event. |
| C6 | `after/src/stock-report.ts:16–23`; `provider-b.ts:41–79`; `validation.ts:11–43` | Invalid snapshots, duplicate SKUs, bad keys/envelopes, noncanonical decimal syntax, unsafe revisions, invalid quantities, and held-over-on-hand values are rejected. Only NO_SUCH_KEY is absence; provider quantities become public numbers. |
| C7 | `after/src/provider-b.ts:37–53,81–108`; `reservation.ts:71–75,98–112`; report/observation catch branches | New host rejections and unusable outcomes yield code-only failures. Provider B revision conflict remains distinct. Successful provider B changes include all required atomic contents, while completed retries produce no additional batch/event. |

These observations independently support the final requirement judgments. They are not inferred solely from matching the frozen reference.

### Discriminating traces and counterevidence

The K002 counterexample no longer violates the contract in K006. With widget stock 12/5/revision 8, no r-1 reservation, quantity 3, and a successful host commit, K006 submits expectedRevision 8, reservedUnits 8, revision 9, the r-1/widget/3 reservation, and one `reservation.created:r-1` event (`after/src/reservation.ts:91–107`). Provider B maps it to the one documented outbox row in its same commitBatch (`provider-b.ts:81–105`). The required event is a real commit argument, not merely an unused object in source.

A failed commit does not require application rollback because the explicit host guarantee retains none of the staged resources (`API.md:98–112`; `CHANGE.md:186–193`). The service returns a failure without another event append. After success, an exact repeat—even through a fresh service instance—finds the stored reservation and returns before stock lookup or commit (`reservation.ts:63–75`). These paths defeat a claim that adding the event creates duplicate reservation events on ordinary retries.

The report's empty snapshot, threshold equality, and duplicate-SKU cases also distinguish actual support from an unexamined positive label: its initialized empty items array is returned for an empty/no-match snapshot; available 3 is excluded at threshold 3 and included at 4; duplicate exact SKUs reject even if the rows would be filtered out (`stock-report.ts:18–29`).

For observations, an unknown SKU with a valid payload reaches the append-only sink; a second valid payload with the same observationId relies on the host's duplicate result and is not rejected because inventory is unavailable. The explicit event construction excludes arbitrary extra fields (`observation-receiver.ts:19–35`).

For provider B, `ok:false/TEMPORARY_FAILURE` cannot enter the missing-record branch, and `ok:true/value:null` fails row validation. Quantity text "01", a held value above on-hand, or an unsafe revision cannot become a valid stock record (`provider-b.ts:41–79`). Provider diagnostic metadata is never copied into public errors. These are source traces, not newly executed tests.

### Calibration recommendation and limits

The consumers pair is suitable for calibration signoff on the inspected evidence:

- K002 detects the seeded substantive defect, retains one root cause, and identifies the necessary one-site correction and its four affected obligations.
- K006 is the frozen correct counterpart in actual source bytes, includes that business effect, and is judged supported without invented architectural or failure-handling defects.
- The judgments therefore distinguish the intended behavioral difference while holding the product contracts and unrelated implementation choices fixed.

No source or judgment discrepancy was found that should block signoff of this consumers calibration pair. This conclusion requires no protocol modification and makes no claim about other calibration cases. It is a bounded check of this positive/negative control pair, not a statistical estimate of false-positive rate, a proof of defect-freedom, or a prediction about the 72 main-experiment results.

No code, tests, compiler, model, network, or Git operation was executed during this addendum. The earlier K002-only scope statements describe the first review stage; this addendum completes the requested K006 check.
