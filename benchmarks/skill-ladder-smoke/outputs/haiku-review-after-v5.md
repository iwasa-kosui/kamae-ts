Now I'll analyze the code against the kamae principles with focus on error handling and state-transition correctness.

## Findings

### **High** `input.ts:9` — Type signature contract violation
The `checkAmount` function declares a return type of `Result<number, {kind: "InvalidAmount"}>` but throws an `Error` on the invalid case instead of returning the error variant. Callers expecting a Result will receive an uncaught exception.

**Fix:** Return the error result:
```typescript
export const checkAmount = (amount: number): Result<number, {kind: "InvalidAmount"}> => {
  if (amount <= 0) return err({kind: "InvalidAmount"});
  return ok(amount);
};
```

---

### **Medium** `input.ts:14–16` — Unrecovered technical fault wrapped as domain result
The `save` function catches an unknown technical fault from `persist` (rejection/outage) and wraps it as a domain result `StorageDecision` without documented recovery. Per the guidance, unknown technical faults should be rethrown unless there is an explicit recovery decision; wrapping and renaming does not constitute recovery.

**Fix:** Propagate the fault:
```typescript
export const save = async (value: Approved): Promise<Result<void, never>> => {
  await persist(value);
  return ok(undefined);
};
```
(If recovery is needed, add explicit decision logic and document it.)

---

**No other findings.** State transitions in `decide` and `amountOf` use exhaustive discriminated unions with proper `assertNever`. Local sentinel control flow in `firstPositive` is acceptable.