# Host additions

The host adds carrierB.reserve({ clientReference, zoneCode, massKg }). Map the
dispatch ID to clientReference and the destination zone to zoneCode. massKg is
a decimal string with exactly three fractional digits representing the parcel's
weight in kilograms. Carrier B returns JSON:

- outcome "confirmed", with ticketId (the booking reference).
- outcome "rejected", with rejectionCode "region" or "capacity".
- outcome "wait", with waitSeconds, a positive integer no larger than 86,400.

Calls are asynchronous and may reject on infrastructure failure. Existing host
operations are unchanged. Public operation names remain the same. Document any
additional public result information in CHANGE-NOTES.md.
