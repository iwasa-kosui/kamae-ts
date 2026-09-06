Confirmed findings:

- **[Medium] `input.ts:10`** — `checkAmount` throws an expected validation failure instead of returning its declared `Result` error. Callers cannot handle invalid input through the Result channel. Replace the throw with `return err({ kind: "InvalidAmount" })`.

- **[Medium] `input.ts:14-16`** — `save` catches arbitrary persistence outages and rebrands them as `StorageDecision`. With no documented recovery decision, this turns an unexpected technical fault into a domain outcome. Let `persist` reject to the application error boundary; make `save` return `Promise<void>`.

- **[Medium] `input.ts:18`** — `ResultAsync.fromSafePromise(persist(value))` asserts that `persist` cannot reject, but the persistence port can reject on outages. This bypasses the Result error channel as an unhandled rejection. Return/await the native `Promise<void>` so the rejection propagates; do not map it into a catch-all Result error.

State transitions are correct for the reviewed scope: `approve` accepts only `Pending`, `decide` handles the wider union with `InvalidState`, and `amountOf` is exhaustive via `assertNever`.