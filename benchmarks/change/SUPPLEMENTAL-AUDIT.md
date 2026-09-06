# Supplemental blind source audit

This layer was added after primary C021 adjudication accepted a false ECMAScript
regular-expression claim. It is a disclosed post-start extension, not part of the
frozen primary protocol. Apply it uniformly to every delivered implementation
in all 72 planned candidates, including supported candidates. Preserve primary
source and outputs exactly. Do not use supplemental findings to revise tasks,
generation prompts, skill snapshots, deadlines, or primary judges mid-experiment.

Auditors may read only assigned anonymous review packages and primary final.json.
Do not read condition mappings, the manifest, summary, generation artifacts, skill
trees, other assigned auditors' candidates, or generation test/log results.
Case IDs are known; release and baseline assignments are withheld. Audit each
completed candidate against all API.md/CHANGE.md requirements and complete source
before/after, using RUBRIC.md's architecture-neutral product obligations.

Challenge every retained primary finding and look for missed necessary corrections
even when primary outcome is supported. Demonstrate the permitted counterexample,
actual path, guards/conversions, host guarantees, required outcome, consequence,
minimal correction and affected requirements. One cause is one finding. Do not
score test outcomes, vocabulary, preferred types/libraries, module/file counts,
formatting or hypothetical future edits. Read implementation source, not tests.
Do not execute implementations/tests. When unsure about language/library semantics,
consult primary language specifications or official dependency documentation and
record the supporting URL; do not assume another language's semantics apply.

Use a separate JSON for every candidate under full/<ID>.json:

- candidate_id; audit_outcome: supported / correction_needed / unverified;
- files_read: every actual before/src and after/src production path;
- requirement_assessments: every B/C ID exactly once, with status, rationale,
  source evidence [{file,line_start,line_end,explanation}] and finding_ids;
- primary_finding_decisions: each original finding ID, verdict accepted / narrowed /
  rejected / duplicate / unresolved, reason, evidence, and duplicate_of or null;
- findings: retained or new findings with id (preserve primary IDs; new S-prefixed
  IDs), requirement_ids, claim, evidence, call_path, counterexample, actual_behavior,
  required_behavior, consequence, minimal_correction, counterevidence, confidence;
- external_semantics_sources: URLs with the specific rule applied, if any;
- overall_assessment; uncertainties.

If the primary review fails but a complete verified source package is available,
audit that source under the same single-pass procedure. Record primary_review_status
as failed and leave primary_finding_decisions empty when no final assessment exists.
Do not rerun the primary model, substitute its model, label it completed, or infer
code failure from a service-capacity error. Keep primary failure and supplemental
source outcome in separate report columns. A failed generation or incomplete
source package remains unverified; do not invent an implementation to assess.

An accepted/narrowed/new necessary correction makes audit_outcome correction_needed.
Otherwise unresolved evidence makes it unverified; otherwise supported. All affected
requirements of a retained finding need matching correction_needed/finding_ids.
A rejected primary claim cannot remain as a required correction. Incomplete impact
enumeration is not an extra root cause. A source-reference bookkeeping error may
be corrected without changing semantic conclusions by fiat.

The call_path field was clarified during the audit to match the existing source
reference validator. Adding the already-inspected call path is a bookkeeping
correction, not a new quality criterion or a request to change the finding.

The case-specialist auditors retain context across candidates, unlike fresh primary
sessions. They remain blind to release assignments, but this layer is not independent
of its earlier candidate context or prior control authoring/audits. Report those
limitations. Primary and audited outcomes must both remain visible; do not pretend
this extension was preregistered or that supported proves defect-freedom.
