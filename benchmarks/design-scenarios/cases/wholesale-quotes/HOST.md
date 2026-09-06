# Host integration

Export createApp(host) from src/index.ts with public operations issueQuote and
getQuote. issueQuote receives JSON with quoteId, customerId, destinationZone, and
lines containing productCode and quantity. getQuote receives JSON with quoteId.
Successful public values are JSON-compatible. Choose and document their shape
and how callers receive business rejections.

| Host operation | Behavior |
| --- | --- |
| records.get(quoteId) | Asynchronously returns the saved JSON record or undefined |
| records.save(quoteId, value) | Asynchronously inserts or replaces a JSON record |
| catalogue.get(productCode) | Asynchronously returns undefined, or JSON with productCode, salesUnit ("each" or "kg"), unitPriceCents, and gramsPerItem for "each" goods |
| customers.get(customerId) | Asynchronously returns undefined, or JSON with customerId, active (boolean), and discountBasisPoints |
| freight.quote({ destinationZone, weightGrams }) | Asynchronously returns JSON with status "available" and chargeCents, or status "unsupported" |
| clock.now() | Returns current Unix time in integer milliseconds |

gramsPerItem is a positive integer. The implementation owns its saved record
format. Storage round-trips JSON and does not preserve methods or object identity.
Asynchronous host operations may reject on infrastructure failure; this task
defines no business recovery policy for those failures. There are no additional
host capabilities.
