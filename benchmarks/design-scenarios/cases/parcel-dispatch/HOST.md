# Host integration

Export createApp(host) from src/index.ts with registerParcel, dispatch, resume,
and getDispatch. registerParcel receives JSON with dispatchId, orderId,
destinationZone, and weightGrams. The other operations receive dispatchId.
Successful public values must be JSON-compatible. Choose and document their
shape and how callers receive business rejections.

| Host operation | Behavior |
| --- | --- |
| records.get(dispatchId) | Asynchronously returns a saved JSON record or undefined |
| records.save(dispatchId, value) | Asynchronously inserts or replaces a JSON record |
| carrierA.book({ reference, destinationZone, weightGrams }) | reference is the dispatch ID; asynchronously returns one of the JSON responses below |
| clock.now() | Returns current Unix time in integer milliseconds |

Carrier A responses:

- status "booked", with bookingReference.
- status "refused", with reason "zone" or "weight".
- status "busy", with retryAtMs, a future integer Unix timestamp in milliseconds.

The implementation owns the record format. Storage round-trips JSON and does
not preserve object identity or methods. Host asynchronous calls may reject on
infrastructure failure. Carrier A is the only booking provider in this version;
there are no other host capabilities.
