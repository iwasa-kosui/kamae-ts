# State Transitions Checklist

Reference: [`../../kamae/state-modeling.md`](../../kamae/state-modeling.md).

## 2.1 Do state transitions constrain source states by argument type? — Medium

Flag: a direct transition primitive whose argument type admits invalid source states, such as `assignDriver(request: TaxiRequest): EnRoute` instead of `assignDriver(waiting: Waiting): EnRoute`. Its argument must constrain callers to valid source states; a union containing only valid sources, such as `CancellableRequest`, is also correct.

Do not flag a decision entrypoint merely because it accepts a wider union. It may narrow `TaxiRequest`, return an expected `InvalidState` error in a `Result` for invalid sources, and invoke the narrow transition only after narrowing. Inspect the decision and transition together: the entrypoint handles expected business outcomes; the transition primitive relies on its source type.

## 2.2 Do `switch` statements over Discriminated Unions have `assertNever`? — Medium

Flag: `switch` on `kind` without `default: return assertNever(x)`. Without it, adding a new variant will not produce a compile error.
