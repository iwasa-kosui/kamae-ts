# Equipment loans

An internal equipment desk records requests, approves lending, hands equipment
over, and records returns. Deliver the server-side module described in HOST.md.
There is no UI, HTTP server, authentication implementation, or deployment.
The host authenticates the caller and authorizes staff-only operations. Calls
are sequential; concurrent booking, crash recovery, and physical stock management
are outside this version. IDs are supplied by the caller.

### L1 — Request a loan

Record a loan ID, asset ID, borrower ID, and requested number of days. IDs are
nonempty strings; days are an integer from 1 through 14. Look up the asset: it
must exist and be available, and the requested duration must not exceed that
asset's maximum. A new request awaits approval. Reusing a loan ID must not replace
the existing record. This module does not reserve stock; the host manages stock.

### L2 — Approve the request

A staff member other than the borrower can approve a pending request. Record
the approver and approval time. Approval does not hand equipment over. Other
stages cannot be approved again.

### L3 — Hand over the equipment

Only an approved loan can be handed over. Ask the host to issue the equipment.
If the host declines, retain the approved loan so staff may try again. A confirmed
issue supplies a nonempty handover reference. Record that reference, the handover
time, and the due time, which is the handover time plus the requested number of
24-hour days. The loan is now active. Do not record a handover without confirmation.

### L4 — Record a return

Staff can return an active loan by supplying a nonempty return receipt ID. Record
the receiving staff member, receipt, and return time; the loan is then closed as
returned. Preserve its approval and handover facts. No inspection step exists in
this version. A closed loan cannot be handed over or returned again.

### L5 — Retrieve and restore loans

Retrieve a loan at any stage by ID, including all facts recorded for that stage.
Records must survive creation of a new module instance through the host's JSON
storage. Missing loans are distinguishable from invalid requests and operations
that are unavailable at the current stage.

### L6 — Explain business rejections

Callers need to distinguish invalid request fields, duplicate or missing loans,
missing or unavailable assets, excessive requested duration, self-approval,
operations unavailable at a stage, and a declined handover. For excessive duration,
include the requested days and the asset's maximum; for a declined handover,
preserve the host's reason. Choose and document how the public interface conveys
success and these rejections. No priority is prescribed when several apply.
