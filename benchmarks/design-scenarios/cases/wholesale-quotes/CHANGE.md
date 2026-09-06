# Accept a quote as an order

### C1 — Reserve credit for the quoted total

Add acceptQuote with quote ID and a caller-supplied nonempty order ID. A quote
can be accepted once. Use its recorded customer and total; do not look up new
prices or re-quote freight. Ask the credit host to reserve that amount for the
order. A held reservation supplies a nonempty authorization ID. Record the order
ID, authorization ID, and acceptance time alongside the original quote facts.
The time is obtained at the start of acceptance. Order IDs are globally unique
by host guarantee, so no order-ID index or cross-quote transaction is required.

### C2 — Handle a credit refusal

A limit refusal supplies a nonnegative shortfall in cents. Tell the caller which
customer and quote were refused and retain the shortfall information. The quote
remains available for a later acceptance attempt. Do not record an accepted order
without a held reservation. Infrastructure failures have no new recovery policy.

### C3 — Preserve issued and accepted documents

Repeat acceptance with the same order ID returns the recorded acceptance without
another credit call or storage write. A different order ID for an accepted quote
is a business rejection. Retrieval shows any acceptance facts without losing the
original pricing. Previously saved quotes remain readable and are not accepted
until this operation succeeds. Existing issue and retrieval behavior is retained.
