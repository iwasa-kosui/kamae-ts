# Parcel dispatch

A dispatch desk requests carrier bookings and resumes work the carrier asks it
to defer. Deliver the server-side module described in HOST.md. The host provides
authentication; no UI, HTTP server, live scheduling daemon, or deployment is
required. Calls are sequential. Crash recovery and concurrent calls are outside
scope. The host calls resume when staff or a scheduler requests another attempt.

### P1 — Register a parcel

A parcel has a caller-supplied unique dispatch ID, an order ID, destination zone,
and weight in integer grams from 1 through 30,000. IDs and zone are nonempty
strings. A new parcel is awaiting a booking attempt. Duplicate IDs must preserve
the previous record. Registration itself does not contact a carrier.

### P2 — Attempt a booking

Only a parcel awaiting its first attempt can use dispatch. Send its recorded
facts to carrier A and record the attempt time obtained at the start of the
operation. A booked response has a nonempty booking reference; retain it and the
carrier identity, and close the dispatch as booked. A refusal has either a zone
or weight reason; retain the reason and close the dispatch as refused. This
version does not try another carrier.

### P3 — Defer and resume

A busy response includes a future retry time in integer Unix milliseconds.
Persist that time, the attempted carrier, and the attempt facts. The dispatch is
deferred. resume may act only on a deferred dispatch and only at or after its
recorded retry time; an early request reports when retry becomes available.
Resume uses the recorded parcel and carrier, then handles the new response in
the same way as the first attempt. Preserve previous attempts in order.

### P4 — Preserve dispatch facts

Retrieve registered, deferred, booked, and refused dispatches. Saved records must
survive construction of a new module instance through JSON storage, including
the facts needed to resume without the previous in-memory objects. Once booked,
repeating dispatch or resume returns its booking without contacting the carrier
or writing storage again. Refused dispatches cannot be attempted again.

### P5 — Explain business rejections

Distinguish malformed input, duplicate or missing dispatch IDs, an operation
unavailable at the current stage, a retry that is too early, and a carrier's final
refusal. Early retry information includes the available time and carrier. Final
refusal information includes the carrier and its reason. Choose and document
how callers receive successful outcomes and business rejections. No priority is
prescribed when multiple issues apply.

### P6 — Keep infrastructure failures distinct from carrier decisions

Only the carrier's documented responses authorize booking, refusal, or deferral.
A rejected host promise is not a busy or refused response, and does not authorize
a final or deferred record. No automatic retry policy is specified for it.
Do not infer a booking when the response lacks its booking reference.
