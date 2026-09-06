# Add explicit carrier recovery decisions

Extend the existing shipping service with Beacon and the business recovery policy below. Preserve the existing behavior identified by B IDs while implementing C1–C7. The starter is the same for all implementations. Any implementation organization is acceptable if it satisfies these observable contracts.

## Required obligations

### B1

Keep createShippingService(dependencies).handle(command) and get/dispatch commands. Validate every required command field before repository lookup, including dispatches of missing or terminal shipments. Invalid commands resolve to 400 {code:'invalid_command'}, missing shipments to 404 {code:'not_found'}. IDs are nonempty strings; dispatch nowMs is a nonnegative safe integer; recipient.name and recipient.postalAddress are nonblank strings. Ignore extra command fields.

### B2

Keep the starter's schemaVersion 1 queued and dispatched JSON records readable. Preserve immutable id, routeCode, and parcelGrams. A successful get returns 200 with the current public shipment, including new states, and does not call a provider, write, or log. Public shipments omit schemaVersion and recipient.

### B3

A queued shipment still tries Atlas first. A valid Atlas confirmation becomes a dispatched record with provider 'atlas', its exact bookingId, and dispatchedAtMs equal to the command's nowMs. Save before the dispatched event and 200 response. Dispatch of an already dispatched shipment returns the saved 200 body with no provider call, write, or log.

### B4

Every carrier request contains the unchanged shipmentId, routeCode, parcelGrams, the command's exact recipient name/postalAddress, and idempotencyKey equal to shipmentId. Use only the supplied nowMs for temporal decisions and dispatchedAtMs. The host supplies the same recipient and nondecreasing nowMs for every dispatch of a shipment.

### C1

Add Beacon reserve as the backup. Only a documented definitive Atlas refusal authorizes one immediate Beacon attempt. Preserve each refusal's carrier and exact allowed reason in attempt order. Normalize Beacon's nonempty reference to public bookingId. Two refusals produce a saved unavailable shipment and 422; dispatch of that terminal shipment returns the same 422 with no effects. Never retry a carrier whose permanent refusal is retained in the current invocation or stored plan. Calls are sequential, with at most one attempt per eligible carrier per invocation.

### C2

A documented rate limit with a safe-integer retryAtMs strictly greater than the current nowMs stops carrier calls, saves a deferred plan for that same carrier with the exact deadline and prior refusals, emits its committed event, and returns 202. Atlas throttling must not try Beacon. Beacon throttling after Atlas refusal must retain Atlas's reason and Beacon selection.

### C3

For a deferred shipment before its deadline, return the saved 202 body without carrier calls, writes, or logs. At or after the deadline, resume only the saved next carrier. A new valid throttle replaces the deadline and preserves prior refusals. A resumed Atlas refusal can authorize Beacon; a resumed Beacon refusal combines with the retained Atlas refusal. Get and resumption must work in a new service instance after JSON round-tripping repository records.

### C4

Unknown carrier rejections, malformed known failure signals, and unusable resolved confirmations stop the invocation with 500 {code:'dispatch_aborted',shipmentId,failedAt,classification,rejections}. Identify the attempted carrier and all prior established refusals. Use unknown_failure for unrecognized rejections and invalid_provider_response for malformed known signals or unusable confirmations. Do not call another carrier or write a new decision. Inspect only documented structured signal fields, not message text. Preserve the last successfully saved record; schedule no retries. A later explicit host dispatch is allowed.

### C5

Treat repository get/save rejection as 500 dispatch_aborted with failedAt 'repository', classification 'repository_failure', and established refusals (empty before a record is read). A get rejection occurs before provider calls. Save a booked, deferred, or unavailable decision before returning its business outcome or logging it as committed. A save rejection leaves the old record intact, causes no more provider calls and no committed-decision event, and emits only the abort event. Repository failures never authorize carrier recovery, even if their values resemble carrier signals.

### C6

Emit exactly one allowlisted diagnostic event for each newly persisted decision or aborted invocation. Dispatched events contain shipmentId, action 'dispatched', and provider. Deferred events contain shipmentId, action 'deferred', provider, exact retryAtMs, and ordered rejections. Unavailable events contain shipmentId, action 'unavailable', and ordered rejections. Abort events contain shipmentId, action 'aborted', failedAt, classification, and ordered rejections. Successful get, invalid/missing commands, early deferred polls, and terminal/idempotent reads emit none. A repository get rejection, including on a get command, emits one abort event. Keep reason and carrier provenance distinguishable even when raw messages are identical.

### C7

Recipient name and postalAddress may exist in transient command/memory and be sent to Atlas and Beacon; they must never flow into repository writes, public responses, or diagnostic events. This applies to all confirmation, fallback, deferral, unknown-failure, and write-failure paths. Do not forward raw command, request, provider response, rejected value, or Error metadata to those surfaces. Select only the documented public business fields; independent contractually non-PII public values need no content-based DLP.

## Carrier contracts (C1, C2, C4, B4)

The changed factory accepts `beacon.reserve(request)` alongside the existing dependencies. Beacon receives the same request fields as Atlas and confirms with `{ reference: string }`; the reference must be a nonempty string. Both carriers' successful identifiers are independent, non-PII opaque values. Extra response metadata is ignored.

Known failure signals are **promise rejections**, not successful responses:

| Carrier | Definitive refusal | Rate limit |
| --- | --- | --- |
| Atlas | `{ code: "cannot_ship", reason: "unsupported_route" \| "unsupported_parcel" }` | `{ code: "rate_limited", retryAtMs: number }` |
| Beacon | `{ type: "rejected", details: { reason: "unsupported_route" \| "unsupported_parcel" } }` | `{ type: "throttled", details: { retryAtMs: number } }` |

The structured codes and documented field values are authoritative. Extra message, request, and other metadata may contain PII or contradict those fields and must be ignored. For example, a refusal reason unsupported_route remains a refusal when its message says "rate limited".

A refusal confirms that no booking occurred and is permanent for this immutable shipment. A rate limit confirms that no booking occurred but keeps the selected carrier. Its deadline must be a safe integer strictly greater than this command's nowMs. Missing, string, fractional, non-finite, or already-due deadlines, or unsupported/missing reasons on recognized signal codes, are malformed known signals.

An unrecognized rejected value, including Error, string, null, or an object with an unknown code/type, is an unknown failure. A failure in one carrier is never interpreted with the other carrier's transport format. A resolved refusal-shaped object without the carrier's valid confirmation field is an unusable confirmation, not a refusal. A valid confirmation field remains authoritative when extra metadata resembles a failure signal. An unknown failure may occur after booking acceptance: there is no cross-carrier idempotency, so it must not trigger automatic fallback.

Each adapter guarantees per-carrier idempotency by shipment ID and does not mutate its request. A later explicit host command can reuse the same key after an abort. No automatic retry occurs after the service returns.

## Public outcomes and persistence (B2, B3, C1–C5)

Public shipment bodies always include `{ id, routeCode, parcelGrams, state }` and contain only the following state-specific information:

| State | Additional public fields | Dispatch status |
| --- | --- | --- |
| queued | none | a queued dispatch attempts Atlas |
| dispatched | `provider`, `bookingId`, `dispatchedAtMs` | 200 |
| deferred | `nextProvider`, `retryAtMs`, `rejections` | 202 |
| unavailable | `rejections` | 422 |

provider and nextProvider are "atlas" or "beacon". Each rejection is exactly `{ provider, reason }`, with one of the two allowed refusal reasons. Lists preserve attempt order. Atlas deferral has no prior refusal; Beacon deferral retains Atlas's refusal. Terminal unavailable contains Atlas's refusal followed by Beacon's. A dispatched body need not retain previous refusals.

A successful get returns status 200 for any state, including deferred and unavailable. It exposes the saved decision without resuming it.

An aborted invocation resolves to status 500 and exactly these contextual fields:

```ts
{
  code: "dispatch_aborted";
  shipmentId: string;
  failedAt: "atlas" | "beacon" | "repository";
  classification: "unknown_failure" | "invalid_provider_response" | "repository_failure";
  rejections: Array<{
    provider: "atlas" | "beacon";
    reason: "unsupported_route" | "unsupported_parcel";
  }>;
}
```

This also applies when repository.get rejects on a get command; its rejections list is empty because no record was read. Unknown rejection and invalid confirmation classifications are distinct. Recognized but malformed rejection signals use invalid_provider_response.

New private storage representation is implementation-owned. It must remain JSON-compatible, read the existing starter records, and retain enough non-PII information to reproduce public deferred/unavailable bodies and resume from a new service instance. No runtime-only object identity may be required. Rejected save leaves the last saved record unchanged.

Abort is an invocation outcome, not a new terminal saved state. An old queued/deferred plan remains after an unknown outcome or failed save. A future explicit host dispatch is allowed. Only refusals retained in a saved plan or the current invocation must suppress a carrier attempt: after a final save fails, an uncommitted Atlas refusal may be observed again on that later explicit dispatch. Every attempt still uses that carrier's original idempotency key.

## Diagnostic contract (C5–C7)

Events contain only the following fields. Emit them after the corresponding successful save, or when aborting; do not emit an uncommitted business decision before a save resolves.

| action | Other event fields |
| --- | --- |
| dispatched | shipmentId, provider |
| deferred | shipmentId, provider (the next carrier), retryAtMs, rejections |
| unavailable | shipmentId, rejections |
| aborted | shipmentId, failedAt, classification, rejections |

For example, an Atlas refusal followed by a Beacon rate limit at 1700 produces an event with action deferred, provider beacon, retryAtMs 1700, and the Atlas refusal. A failed write of that plan produces only action aborted, failedAt repository, classification repository_failure, and the Atlas refusal.

Successful reads emit none. A rejected repository read, including on get, emits the one abort event described above. Logger exceptions are excluded; no event buffering or delivery retry is required.

## Concrete behavior examples (C1–C7)

These are examples of the requirements, not an exhaustive set of checks or a prescribed implementation.

| Command/dependency sequence | Required effects and outcome |
| --- | --- |
| Queued dispatch; Atlas confirms A1. | Atlas → save dispatched → dispatched event → 200; Beacon unused. |
| Atlas refuses parcel; Beacon confirms B1. | Atlas → Beacon → save Beacon booking B1 → dispatched event → 200. |
| Atlas refuses parcel; Beacon refuses route. | Save unavailable; 422 and event retain Atlas/parcel then Beacon/route. |
| At nowMs 1000 Atlas throttles until 1500. | Save Atlas deferred at exactly 1500; 202; no Beacon attempt. |
| Atlas refuses route; Beacon throttles until 1700. | Save Beacon deferred and retain Atlas/route; 202. |
| A new service dispatches that plan at nowMs 1699. | Same deferred 202, no provider/write/log. |
| At nowMs 1700 Beacon refuses parcel. | Only Beacon is called; save unavailable with Atlas/route then Beacon/parcel; 422. |
| Due Beacon supplies a later valid deadline. | Keep Beacon and Atlas's refusal; replace deadline exactly. |
| Atlas refuses route; Beacon rejects an Error containing recipient data. | 500 failedAt beacon, unknown_failure, Atlas/route; no write/fallback; safe abort event. |
| Atlas rejects a rate limit with retryAtMs equal to nowMs. | 500 invalid_provider_response; no write or Beacon call. |
| Atlas resolves a refusal-shaped object without bookingId, or an empty bookingId. | 500 invalid_provider_response; no write or Beacon call. |
| repository.get rejects an Atlas-shaped rate limit. | 500 repository_failure; no carrier call or deferred write. |
| Beacon confirms after Atlas refusal, but save rejects. | 500 repository_failure with Atlas refusal; no further provider call or dispatched event. |
| Saving deferred or unavailable rejects. | Old record retained; 500 and only the abort event. |

When considering privacy, place protected values in recipient fields and metadata derived from provider requests. IDs, route codes, booking identifiers, and reason enums are contractually non-PII. Coincidental equality of unrelated public values is not a leak; direct propagation of a recipient value is.

## Assumptions and exclusions

The host guarantees nondecreasing nowMs and an unchanged recipient for a shipment; required command types/ranges must still be validated. Time arithmetic, local time zones, wall-clock reads, sleeps, scheduling, and periodic workers are unnecessary. The service receives host-created queued records, historical starter dispatched records, and records it wrote itself, including through JSON round trips.

No concurrency, process crashes, distributed transaction, compensation, cancellation, editing, refund, authorization policy, arbitrary storage tampering, real shipping network, strict postal-address parsing, or logger-exception behavior is in scope. No scanning of arbitrary public text for PII is required. A confirmed booking followed by a failed save need not be rolled back; per-carrier idempotency supports an explicit later retry.

There is no requirement for a Result library, exception class, validation library, state-machine pattern, file count, branded types, or particular module structure. Preserve context by any reliable means. Assessment concerns contractual behavior, information retention, protected data flow, and effect order.
