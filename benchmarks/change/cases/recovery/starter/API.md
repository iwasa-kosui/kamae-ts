# Existing shipping service API

This starter is the working service before the requested change. The host creates shipments; the service reads them and books Atlas. The change request is in the adjacent CHANGE.md.

## Entry point and commands

Import `createShippingService` from `src/index.ts`. It accepts repository, atlas, and logger dependencies and returns `{ handle(command: unknown): Promise<ServiceResponse> }`. All supported dependency failures become responses; the promises returned by handle resolve under the assumptions below.

Commands:

- `{ op: "get", shipmentId: string }`
- `{ op: "dispatch", shipmentId: string, nowMs: number, recipient: { name: string, postalAddress: string } }`

An ID is a nonempty string and is preserved exactly. Whitespace-only IDs are not normalized or specially rejected. nowMs is a nonnegative safe integer, in epoch milliseconds. Recipient fields are nonblank strings; their original values, including surrounding whitespace, are preserved. Required fields are checked before repository lookup, even for missing or dispatched shipments. Extra fields are ignored. No email or postal-address syntax validation is required.

Invalid commands return `400 { code: "invalid_command" }`. Missing shipments return `404 { code: "not_found" }`.

## Host and storage contract

The host authenticates/authorizes callers and owns recipient storage outside this service. It supplies the same recipient and nondecreasing nowMs for all dispatch commands for a shipment. The supplied number is the only time source.

The host initially stores a record such as:

```json
{"schemaVersion":1,"id":"shipment-1","routeCode":"ZONE-N","parcelGrams":500,"state":"queued"}
```

id is the lookup key. routeCode is a nonempty string; parcelGrams is a positive safe integer. These three fields are non-PII and immutable. The service does not create, edit, or delete shipments.

A saved dispatched record has those same four base fields plus:

```json
{"state":"dispatched","provider":"atlas","bookingId":"atlas-1","dispatchedAtMs":1000}
```

repository.get(id) returns stored JSON or undefined and may reject. repository.save(id, record) replaces the whole JSON record and may reject. Rejected saves leave the previous record unchanged. A successful save survives JSON serialization/parsing and service reconstruction. Only host-created queued records and this service's own records are supplied; arbitrary corrupt or foreign storage is out of scope.

## Carrier and diagnostics

atlas.book(request) receives exactly:

```ts
{
  shipmentId: string;
  routeCode: string;
  parcelGrams: number;
  recipient: { name: string; postalAddress: string };
  idempotencyKey: string; // equal to shipmentId
}
```

It resolves to an object with a nonempty, non-PII opaque bookingId string, or rejects with an arbitrary value. Additional successful-response metadata is ignored. A resolved value without a valid bookingId is unsuccessful. Atlas guarantees repeated calls with the same idempotency key do not create additional bookings at Atlas. The adapter does not mutate requests.

A queued dispatch calls Atlas once. On confirmation, save state dispatched using the command's nowMs, then call logger.info with `{ shipmentId, action: "dispatched", provider: "atlas" }`, then return 200. Recipient values may be sent to Atlas but never appear in saved records, response bodies, or events.

logger.info records a synchronous event. Logger exceptions and event-delivery retries are outside the contract.

## Responses and repeated calls

A public shipment omits schemaVersion and contains id, routeCode, parcelGrams, state, and the dispatched fields when applicable. Successful get returns 200 and has no carrier, write, or log effects. Dispatch of an already dispatched shipment returns its saved 200 body with no such effects, even if nowMs has advanced.

Repository rejection, unsuccessful Atlas calls, and unusable confirmations return `500 { code: "service_unavailable" }`. They do not log a completed booking. A failed read makes no carrier call; an unsuccessful Atlas outcome makes no write; a failed save makes no additional carrier call and leaves the old record unchanged. The change request may replace this generic 500 body with its specified contextual abort body.

No concurrency, crash consistency, distributed transactions, compensation, automatic retries, background tasks, real timers, network access, or recipient editing is required. A later explicit host dispatch after a failed save may recover Atlas's confirmation using the same key.
