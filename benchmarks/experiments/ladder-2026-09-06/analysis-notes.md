# Analysis notes

## Pricing uncertainty

The CLI emits cumulative usage over all tool turns in a phase, not per-request
input length. A phase total below 272K proves that no request crossed the GPT-5.5
long-context threshold. A larger total does not prove that a request crossed it.

Following the protocol's uncertainty rule, analysis leaves `apiEquivalentUsd`
unknown when this conservative bound is insufficient. It additionally reports
`standardApiEquivalentUsd` at the preregistered standard rates and an
`apiEquivalentUpperUsd` assuming the long-context multipliers for the entire
phase pair. These are a nominal estimate and conservative price bounds, not an
invoice. Cross-model savings can be assessed conservatively against the stronger
model's standard-rate lower bound. Within-model standard-rate ratios are labeled
as such; they do not establish exact invoiced savings.

This reporting clarification was written while the first implementation in each
model block was running, after observing that the design phases already accumulated
140,693 and 237,153 input tokens over many tool calls. It does not change treatment,
generation settings, sample size, quality criteria, or the token metric.

## Exploratory boundary checks

Inspection of mini/01-kamae found a permissive email regex that appears to admit
unquoted local parts with leading, trailing, or consecutive dots. R1 requires
syntactically valid email. [RFC 5322 sections 3.2.3 and 3.4.1](https://www.rfc-editor.org/rfc/rfc5322.html#section-3.2.3)
define the dot-atom structure that excludes these forms.

After that observation, but before the remaining outputs finished, the fixed
`email-probe.test.ts.txt` was written with three invalid forms and one ordinary
valid plus-address control. Run it unchanged against every completed output,
including controls, in fresh projects. Preserve original sources and original
19-check results. Report this separately as post-hoc exploration, never as a
preregistered result or a complete RFC conformance suite. No model sees the probe.

Review of mini/01-kamae-ladder then exposed a second boundary gap: payment handling
checks for decline and a receipt but does not require `kind: "paid"`. A fifth
probe was added before running any probe: `{ kind: "pending", receiptId: "..." }`
must produce 500, leave the record approved, and perform no save. This follows R5's
requirement for confirmed payment and tests an unusable gateway response not
covered by the original 19 checks. All five probes are applied to all outputs.

```sh
bun run benchmarks/experiments/ladder-2026-09-06/probe.ts \
  benchmarks/results/ladder-email-probes \
  benchmarks/results/ladder-mini-2026-09-06 benchmarks/results/ladder-5.5-2026-09-06
```
