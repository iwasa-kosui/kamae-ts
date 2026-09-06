# Pre-generation source audits

These independent source reviews were completed before freezing the experiment.
All nine source variants passed the pinned TypeScript toolchain. Typechecking is
fixture verification, not a semantic score.

The minor wording concerns in the intake and consumers audits were resolved before
freezing: public field types are preserved without mandating internal type names;
unknown operations and invalid required fields are rejected while extra fields
are ignored. The case manifests were aligned with the final change contracts.

Earlier exploratory proposals are retained outside the shipped protocol in local
benchmarks/results/change-design-notes-20260906. Their suggested test suites and
alternative fixture shapes were not adopted. CHANGE.md/API.md and the implemented
runner are authoritative for this experiment.

Release hypotheses derive from the actual tag diffs: v1.1 error context is exercised
by recovery; v1.2 schema input/output and existing-code adaptation by intake;
v1.3 recovery classification by recovery; v1.4 consumer capabilities and atomic
state/event writes by consumers. These hypotheses do not assume newer tags win.
The supplied treatment is the generation skill; review-skill changes are not
measured by this experiment.
