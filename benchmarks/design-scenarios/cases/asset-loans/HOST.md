# Host integration

Export createApp(host) from src/index.ts. Its public operations are requestLoan,
approveLoan, handOver, returnLoan, and getLoan. The host passes JSON inputs:

| Operation | Input fields |
| --- | --- |
| requestLoan | loanId, assetId, borrowerId, days |
| approveLoan | loanId, staffId |
| handOver | loanId |
| returnLoan | loanId, staffId, returnReceiptId |
| getLoan | loanId |

Successful public values must be JSON-compatible. Choose and document their shape
and the mechanism by which the caller receives a business rejection.

| Host operation | Behavior |
| --- | --- |
| records.get(loanId) | Asynchronously returns the saved JSON record or undefined |
| records.save(loanId, value) | Asynchronously inserts or replaces a JSON record |
| assets.get(assetId) | Asynchronously returns undefined, or JSON with assetId, available (boolean), and maxDays (integer 1–14) |
| equipment.issue({ loanId, assetId, borrowerId }) | Asynchronously returns JSON with status "issued" and reference, or status "declined" and a nonempty reason |
| clock.now() | Returns the current Unix time in integer milliseconds |

The implementation owns its saved record format. Storage round-trips values
through JSON; it does not retain object identity or methods. A time recorded for
an operation is the time obtained at its start. Host asynchronous operations may
reject on infrastructure failure; this version specifies no business recovery
policy for those failures. There are no other host capabilities.
