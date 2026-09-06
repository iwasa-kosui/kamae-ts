# Inspect equipment after return

### C1 — Separate physical return from closing a loan

For new returns, returnLoan still records the receipt, receiving staff member,
and return time, but the loan now awaits inspection. It cannot be handed over
again. It is not yet closed as returned. Preserve all previous loan facts.

### C2 — Record an inspection outcome

Add inspectReturn. Staff supply a loan ID, staff ID, inspection report ID, and
either "usable" or "repair". All IDs must be nonempty. A repair outcome also
requires nonblank repair notes. Inspection is available only for a loan awaiting
inspection. Record the inspector, report, time, and outcome. A usable item closes
the loan as returned; a repair outcome closes it as requiring repair and retains
the notes. Both outcomes are final. No repair-management feature is requested.

### C3 — Keep earlier records usable

Continue reading records written by the initial implementation. Loans that were
already closed as returned remain closed; do not invent an inspection report
for them. Initial requests, approval, handover, and their rejection information
retain their meaning. Retrieval must show the new return and inspection facts
where they exist. Document the additional public outcomes.
