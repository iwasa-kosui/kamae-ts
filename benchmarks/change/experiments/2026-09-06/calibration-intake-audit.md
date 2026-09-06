# Intake calibration source check

The supervising agent read the reference production modules, CHANGE.md, API.md,
K004's final finding/decisions, and K005's final requirement assessments. This is
a source judgment; no implementation or test was executed for this assessment.

K004's retained A_F1 establishes one necessary correction. Its batch.ts:36 adds
order.amountCents / 100 after saveOrder returns 201, whereas both the previous
consumer contract and C6 require canonical integer cents. An accepted 1250-cent
legacy order therefore contributes 12.5 to the summary, while its saved and row
bodies still contain 1250. Replacing that term with order.amountCents repairs the
same cause for legacy and version 2 rows. The adjudicator correctly merges the
two critics' equivalent claims and attributes B5/C6 to that single correction.
Rejected, duplicate, and failed rows remain excluded; the date maximum is intact.

K005's supported outcome is consistent with the inspected reference source. The
version discriminants prevent a malformed version 2 payload from falling through
to legacy cents. Decimal normalization splits whole and fractional text and then
range-checks the canonical number. Date validation checks Gregorian components
before formatting and uses the trusted receivedOn only for omitted version 2
dates. Both consumers call the same parser and persistence operation; saves copy
only canonical fields and batch summaries use completed saves. API.md explicitly
limits inputs to JSON values, so JavaScript-only present undefined properties are
not counterexamples to omission semantics. No additional necessary correction was
established in this inspection.

This confirms these control outcomes and the concrete correction. It is not a
proof that every possible candidate defect will be detected by the judges.
