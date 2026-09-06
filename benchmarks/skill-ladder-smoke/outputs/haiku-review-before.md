## Confirmed Findings

Based on my review of `input.ts` against the kamae principles for error handling and state-transition correctness:

### 1. **checkAmount throws instead of returning Result error** — Medium

`input.ts:10`

Per [`error-handling.md` §3.1](skills/kamae-review/checklist/error-handling.md), expected validation failures must be returned as `Result` errors, not thrown. The function signature declares `Result<number, {kind: "InvalidAmount"}>` but throws instead:

```typescript
// Current (incorrect):
export const checkAmount = (amount: number): Result<number, {kind: "InvalidAmount"}> => {
  if (amount <= 0) throw new Error("InvalidAmount");
  return ok(amount);
};

// Fix:
export const checkAmount = (amount: number): Result<number, {kind: "InvalidAmount"}> => {
  if (amount <= 0) return err({kind: "InvalidAmount"});
  return ok(amount);
};
```

---

### 2. **save wraps infrastructure rejection as catch-all domain error** — Medium

`input.ts:14-17`

Per [`error-handling.md` §3.1](skills/kamae-review/checklist/error-handling.md) and the guidance that "unknown infrastructure faults should propagate to the application error boundary instead of becoming catch-all domain errors," the `save` function catches arbitrary persistence failures and wraps them as `{kind: "StorageDecision", detail}`. Given that "the persistence port can reject on outages and there is no business recovery decision for them," this catch-all error should not be part of the domain `Result` union.

```typescript
// Current (incorrect):
export const save = async (value: Approved): Promise<Result<void, {kind: "StorageDecision"; detail: unknown}>> => {
  try { await persist(value); return ok(undefined); }
  catch (detail: unknown) { return err({kind: "StorageDecision", detail}); }
};

// Fix: let rejection propagate to application error boundary
export const save = async (value: Approved): Promise<void> => {
  await persist(value);
};
```

---

### 3. **saveSafe misuses fromSafePromise on rejectable Promise** — High

`input.ts:18`

Per [`error-handling.md` §fromSafePromise Misuse](skills/kamae/error-handling.md), `ResultAsync.fromSafePromise` asserts the wrapped Promise **never rejects**. Since `persist` can reject on outages, this violates the contract and results in unhandled rejection at runtime. With no documented recovery decision, let the rejection propagate:

```typescript
// Current (incorrect):
export const saveSafe = (value: Approved) => ResultAsync.fromSafePromise(persist(value));

// Fix: either await and let rejection propagate, or use fromPromise with recovery only if documented
export const saveSafe = async (value: Approved): Promise<void> => {
  await persist(value);
};
```

---

### 4. **decide accepts union Request instead of specific Pending state** — Medium

`input.ts:7`

Per [`state-transitions.md` §2.1](skills/kamae-review/checklist/state-transitions.md), transition functions must constrain source states by argument type. Taking `Request` (the union) allows callers to apply `decide` to `Approved` states, which should be a compile error rather than returning an error at runtime:

```typescript
// Current (incorrect):
export const decide = (request: Request): Result<Approved, InvalidState> =>
  request.kind === "Pending" ? ok(approve(request)) : err({kind: "InvalidState"});

// Fix: accept only the valid source state
export const decide = (pending: Pending): Approved => approve(pending);
```