# Host additions

Add public acceptQuote({ quoteId, orderId }). The host adds:

| Host operation | Behavior |
| --- | --- |
| credit.reserve({ orderId, customerId, amountCents }) | Asynchronously returns JSON with status "held" and authorizationId, or status "limit" and shortfallCents |

Credit reservations use orderId as their idempotency key. Calls may reject on
infrastructure failure. Existing host operations are unchanged. Continue using
records keyed by quote ID; no separate order store is supplied. Document public
interface additions in CHANGE-NOTES.md.
