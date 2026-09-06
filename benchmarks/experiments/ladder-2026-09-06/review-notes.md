# Exploratory source review

This is an unblinded review of generated artifacts, not an independent numeric
quality score. Acceptance outcomes remain the preregistered primary endpoint.
Source paths below are relative to each run's `workspace/` in the artifact bundle. No observations
were fed back to generation, and no generated output was repaired.

## mini / 01-kamae

The held-out R4 test detects lost review history on payment: the response has the
receipt and amount but omits `reviewerId`. In `src/expense.ts`, `Paid` contains
only `kind` and `receiptId`; `transitionToPaid` replaces the entire state with
those fields; the paid branch of `toBody` cannot return a reviewer. The design
already omitted the reviewer from its paid-state proposal. This is a concrete
requirements defect spanning design, persisted state, and response projection,
not a style preference or a test that rewards a kamae pattern. The generated
self-tests pass despite the missing field.

## 5.5 / 01-kamae

All held-out checks pass. `src/api/adapters.ts` validates payment responses and
stored records, `src/api/responses.ts` uses an explicit public projection, and
`src/application/pay-expense.ts` returns a paid expense before further effects.
The paid projection retains both reviewer and receipt.

There are concrete opportunities to reduce repetition: `src/api/commands.ts`
constructs the same command union twice for `schema` and `parse`;
`src/api/handle.ts` repeats status/error mappings across related operations.
These are maintainability observations, not demonstrated product defects. The
number of files alone is not a quality score. Logger failure after persistence
is documented by the implementation; logger exception semantics and process-crash
recovery are not established by this product benchmark.

## mini / 01-kamae-ladder

All original 19 checks pass and the paid-state model retains reviewer and receipt.
However, `src/service.ts` checks for `kind === "declined"`, then only the presence
of a nonblank receipt. It does not positively require `kind === "paid"` before
saving. An unknown gateway kind accompanied by a receipt can therefore enter
the paid state, violating R5. The fixed exploratory probe checks this dynamically
for every output. `src/validation.ts` also uses the permissive email regex found
in the first mini control. These are boundary correctness concerns despite the
original acceptance result, not penalties for using manual validation.

## 5.5 / 01-kamae-ladder

All original checks pass. Compared with the first 5.5 control, `src/index.ts`
centralizes error responses and successful-change logging; related use cases
share `saveSuccess` in `src/application/use-cases.ts`. These are concrete
reductions of repeated mappings. `src/infrastructure/payment-codec.ts` requires
one of the two valid gateway discriminants, and `payExpense` returns early for
already paid records. Boundary validation and effect ordering remain explicit.

## 5.5 / 02-kamae-ladder

All original checks pass. `src/index.ts` shares load/error mapping and save/log
steps, positively checks `paymentResult.kind === "paid"`, validates the receipt,
and preserves the already-paid early return. `src/domain/expense.ts` uses a shared
base record with state-specific fields and direct transition-error unions.
This departs from kamae's preference for repeated common fields and Result
wrappers, while preserving the behavior measured here. Receiving the full skill
is not proof of complete stylistic adherence; such departures are not themselves
quality failures under this product-oriented rubric.

## mini / 02-kamae-ladder

The same original R4 failure as mini/01-kamae recurs: the paid public body loses
`reviewerId`. `src/domain/expense.ts` omits it from the paid state and transition,
and `src/domain/response.ts` cannot project it. The implementation notes also
acknowledge a deviation from the proposed Zod design to manual parsers. This is
a failed build under the preregistered quality gate despite passing typecheck
and self-tests; the ladder did not reliably prevent the requirements omission.

## 5.5 / 02-kamae

All original checks pass. The implementation separates command validation,
storage codecs, response projection, and six use cases. Payment preserves the
reviewer in the paid state and checks an already-paid record before calling the
gateway. The proposal's generic Standard Schema helper was replaced by direct
Zod parsing when the selected dependency set did not expose that extra package;
this adjustment and its compiler work are included in measured generation cost.

## mini / 02-kamae

The original R5 unusable-gateway test fails because `undefined` is dereferenced
as `chargeResult.kind` outside the catch that guards the gateway call. The
adapter rejects instead of resolving a 500 response. `src/service.ts` is the
affected orchestration file. The paid reviewer is retained in this run, showing
that the primary failure mode varies between repetitions. Its proposed runtime
libraries were not selected during design (the recorded dependencies are empty),
and the implementation instead wrote local parsers and a local Result helper.

## 5.5 / 03-kamae

All original checks pass. `src/infrastructure/host-payment.ts` validates the
gateway discriminant and receipt before the use case receives a paid result;
the paid transition retains review data. The implementation keeps one use case
per operation and an explicit public error boundary, with the same observable
workflow and privacy obligations as the smaller implementations.

## 5.5 / 03-kamae-ladder

All original checks pass with three implementation files and no runtime
dependencies. `src/index.ts` positively requires a paid gateway kind and catches
unusable responses; review history is retained. However,
`src/application/validation.ts` uses the same permissive email regex seen in the
mini outputs, so it is subject to the same exploratory email probes. This run
also drops branded IDs and collapses proposed per-value files; the implementation
notes attribute that choice to the ladder. The concrete email-validation gap,
rather than the absence of brands or a particular library, limits a quality claim.
The common exploratory suite confirms this: all three malformed emails are
accepted, while the valid-address control and unconfirmed-payment rejection
pass (2/5). The other five GPT-5.5 outputs pass all five probes.

## mini / 03-kamae

The original R5 failure repeats: `src/expense-service.ts` dereferences
`chargeResult.kind` after leaving the catch that surrounds the dependency call.
An undefined gateway response therefore rejects instead of returning 500.
The implementation notes claim that gateway misuse maps to 500, which is not
supported for this tested input. Its simple email regex is also evaluated by
the common exploratory suite. Assertions in implementation notes are not used
as quality evidence when executable checks contradict them.

## mini / 03-kamae-ladder

The original R5 unusable-gateway test fails again: `src/service.ts` accesses
`paymentResult.kind` outside the catch guarding the dependency call. Review
history is retained, but malformed gateway output escapes as a rejected promise.
The common exploratory suite passes only the valid-address control (1/5),
confirming both permissive email syntax and acceptance of an unconfirmed payment.

## Common exploratory outcome

All six mini outputs accept the three invalid email forms. Five also mark the
unconfirmed gateway response paid; mini/01-kamae correctly rejects that response.
GPT-5.5 without the ladder passes every probe in all three runs; with the ladder,
two pass every probe and the third accepts the three malformed emails.
Original source hashes remain unchanged across every probe run. These checks
demonstrate specific gaps; five probes are not an exhaustive boundary audit.
