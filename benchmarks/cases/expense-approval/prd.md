# Employee expense approval

Employees need to record expenses, get a colleague's approval, and receive payment.
Deliver a server-side TypeScript module. The host provides storage and a payment
gateway; the integration format is specified in API.md. No UI, HTTP server,
authentication provider, or deployment is needed. The host authenticates callers
and authorizes finance to make payments. Requests are sequential; concurrent
requests and recovery after process crashes are outside this version's scope.

## Product requirements

- **R1 — Record an expense.** An employee records an expense with a unique ID,
  their employee ID and email, a description, and an amount in USD cents.
  IDs must be nonempty strings, the email must be syntactically valid, the
  description must contain non-whitespace text, and the amount must be an integer
  from 1 through 1,000,000. Invalid submissions must not be saved or paid.
  Reusing an existing ID must preserve the original expense and report a conflict.
- **R2 — Submit.** New expenses are drafts. Only their owner can submit them.
  This version has no editing feature.
- **R3 — Review.** A different employee can approve or reject a submitted expense.
  Both decisions record who reviewed it. Rejection also requires a nonblank reason
  and is final. An employee cannot review their own expense.
- **R4 — Pay.** Finance can pay an approved expense for its recorded amount and
  owner email. Use the expense ID as the gateway's idempotency key. After payment,
  retain the receipt. Repeating a completed payment returns the same receipt
  without another gateway call or storage write.
- **R5 — Failed payment.** If the gateway declines payment, tell the caller that
  payment was declined and allow another attempt. An unavailable gateway or
  storage service must produce an unsuccessful response. Do not save an expense
  as paid unless the gateway confirms payment with a nonempty receipt ID.
- **R6 — Retrieve and restrict operations.** An expense can be retrieved at any
  stage. Missing IDs are reported as missing. Operations must follow the workflow
  above; for example, drafts cannot be paid, and paid expenses cannot be reviewed.
  Required command fields must be present even when the ID does not exist.
- **R7 — Keep email private.** The owner email is used by storage and the payment
  gateway. Responses and diagnostic logs must not disclose it. Successful changes
  should leave a diagnostic event identifying the expense and the action.
