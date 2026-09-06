# Use a second carrier for weight refusals

### C1 — Fall back for one specific refusal

If carrier A refuses an attempt because of weight, try carrier B during that
same public operation. A zone refusal remains final. A busy response from A
still defers A; do not contact B in that case. Preserve both attempt records
when fallback occurs. A booking from B closes the dispatch with B's identity
and booking reference. A refusal from B is final with B's reason; retain A's
preceding weight refusal in the attempt history.

### C2 — Persist the authority to resume

If B asks to wait, defer B and record its retry time: B's attempt-start time plus
waitSeconds multiplied by 1000. On a later resume, contact B directly using the
saved context; do not repeat A's attempt. B can book, refuse, or ask to wait again.
Capture a new attempt-start time for each actual carrier call. Attempt history
must retain the carrier, time, outcome, and supplied reason or retry information.

### C3 — Retain the initial implementation's records and outcomes

Previously saved deferred records still mean carrier A and resume with A. Earlier
booked and refused records retain their meaning. New public outcomes identify
the carrier whose decision is being reported, including retry timing. Existing
booked-operation repetition behavior remains. No new recovery rule is introduced
for rejected promises or undocumented carrier responses.
