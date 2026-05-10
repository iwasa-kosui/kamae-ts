# State Transitions Checklist

Reference: [`../../kamae/SKILL.md` §2](../../kamae/SKILL.md), [`../../kamae/state-modeling.md`](../../kamae/state-modeling.md).

## 2.1 Do state transitions constrain source states by argument type? — Medium

Flag: a transition function whose argument type is the union (`TaxiRequest`) instead of the specific source state (`Waiting`). The wider type allows callers to apply the transition to invalid source states.

## 2.2 Do `switch` statements over Discriminated Unions have `assertNever`? — Medium

Flag: `switch` on `kind` without `default: return assertNever(x)`. Without it, adding a new variant will not produce a compile error.
