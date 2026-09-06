# Independent harness audit

Scope: `run.ts`, `protocol.ts`, `schema.ts`, `validate.ts`, and `report.ts`, with their shared `../runner/{context,files,process,protocol}.ts` dependencies. The final pass also read README.md to distinguish implementation guarantees from documented limitations. This audit did not grade case/control implementations, inspect experimental outcomes, invoke generation/judging models, or use the network.

The first pass found material freeze and judgment-bookkeeping gaps. They were corrected during the audit. The final inspection reflects the revised code immediately before/around calibration preparation, not the original draft. No additional blocking/high issue was established for the documented macOS experiment after those corrections. The residual items below are concrete medium-priority operating boundaries; none is evidence that an experimental candidate actually exhibited the described condition.

Only `validate.ts`, `validate.test.ts`, and this memo were changed by this auditor during the harness task. Root performed the other corrections. Once calibration was prepared, further protocol changes require a new experiment.

## Corrections verified

| Area | Initial problem | Verified final protection |
| --- | --- | --- |
| Frozen experiment | Skill/rule hashes and runner hashes were recorded but not compared by the old freeze gate. Shared runner helpers were outside the recorded source set. | `run.ts:18–21,95–112,117–135` saves executable protocol sources including shared helpers, checks manifest bytes, executing and saved source hashes, schemas, skill/rule trees, case/control snapshots and prompts. `run.ts:147` repeats the gate before each model stage. |
| Calibration provenance | An accepted flag and rubric hash alone could authorize a different preparation or changed control assessment. | `run.ts:184–192` requires a matching manifest hash, completed review of every planned control, and matching final-review hashes in the source-based signoff. This checks provenance of the supervisory judgment, not whether its conclusion is true. |
| Cross-process isolation | Separate generation/review invocations originally knew only their own temporary-workspace family. | `run.ts:141–166` creates a shared experiment temporary root, denies all sibling workspace data except the current workspace, and probes reads of a real sibling file and experiment artifact before invoking a model. Existing personal-instruction and artifact denial remains in `runner/context.ts:12–37`. |
| Installed dependencies | Hash traversal deliberately omits node_modules, leaving an unobserved mutation surface inside writable workspaces. | The macOS profile now denies writes to the current node_modules tree (`run.ts:155`). Reviewers receive dependencies installed from the frozen lockfile (`run.ts:281–282,326–331`). This closes the identified macOS path; audit-only isolation remains weaker by design. |
| Production inventory | The old bundle included only .ts files, although allowed source changes could introduce other runtime source formats. | `run.ts:242–246` now includes all files except the explicit test-name exclusions. The remaining classification caveat is O1 below. |
| Retained findings versus requirements | A finding could list B1 and C1, be reflected only under C1, and leave B1 supported. An unresolved proposal could coexist with an entirely supported final profile. | `validate.ts:69–95,102–128` checks both directions of finding/requirement links. Every affected obligation of a retained final finding must be correction_needed and reference it. An unresolved proposal requires its affected obligations to remain unverified unless a separate retained correction already establishes correction_needed. Supported obligations cannot reference findings. |
| Evidence bookkeeping | Empty evidence arrays, or an arbitrary in-package document used as if it were production source, could satisfy the formal gate. | `validate.ts:31–66,73,84,97–111` requires actual before/src or after/src inventory references for supported obligations, corrections and affirmative implementation/consumer claims. References must be regular, non-aliased files with available line ranges. API.md/CHANGE.md may supplement source evidence and support contract-based rejection. Unverified/unresolved judgments may honestly lack source evidence but must give nonempty rationale/reason. |
| Critic IDs | Combining critics prefixed finding IDs but initially left requirement references unprefixed. | Root's fix in `validate.ts:133–138` prefixes the references consistently. The new bookkeeping tests preserve and verify this behavior. |
| Retention and final-output provenance | Final summaries needed to remain traceable to raw independent outputs and the actual inspected package. | `run.ts:232–235,277,293–316,369–395` archives generation snapshots, retains stage outputs, compares packages to before/after originals, checks final against the selected adjudicator output, reconstructs the combined critique from the two selected critic outputs, and revalidates final bookkeeping. |

Raw JSON publication was already being corrected by root when this audit began; it is not presented as a newly discovered unresolved issue.

## O1 — Test-name exclusion can remove a runtime dependency

Priority: medium. Status: residual classification limit.

Evidence: `run.ts:242–254` classifies files as tests solely from __tests__ directories or .test/.spec suffixes and removes them from after/src. `run.ts:382–384` applies the same filter when checking that the reviewed source matches the original. `protocol.ts:8–10` allows production changes and tests under src without reserving these filenames exclusively for unreachable test code.

Concrete counterexample: a delivered src/index.ts re-exports its actual service implementation from ./service.spec.ts. That module implements the public API and is present in the archived generation. It is an ordinary runtime dependency despite its unfortunate name. Packaging deletes it, the bundle omits it, and verification compares against the same filtered inventory. A reviewer can then report a missing implementation in a package that differs from the delivered program.

This is not a reason to score naming choices. The problem is assessing different source.

Minimum correction for a later protocol: retain any module reachable from the public production entry points regardless of its filename; exclude only test-only code. At minimum, detect a production import of an excluded file and report a packaging limitation rather than silently treating that file as absent from the delivery. Do not infer that test assertions prove behavior merely because an imported test-named file must be retained as runtime source.

Counterevidence/limit: the new broad inventory fixes .mts/.js and other non-test filenames. The defect requires an actual production dependency on an excluded file; this audit has not established such a dependency in an experimental submission.

## O2 — A killed runner leaves an attempt permanently nonterminal

Priority: medium. Status: documented recovery limitation, not a silent successful result.

Evidence: `run.ts:207–210` writes generation status running and later skips any candidate for which generation.json exists. `run.ts:272–275` does the same for reviews. `run.ts:340–347` treats a running generation as pending, and `report.ts:28–29` cannot mark the experiment finished while it remains running.

Concrete counterexample: the operating system kills the parent process after the running record is published but before its finally block. Re-running generate/review skips that existing record. Review watch can remain pending indefinitely. Raw files may still exist, but the attempt never becomes failed/completed through the normal commands.

Minimum correction for a later protocol: persist an attempt identifier/process lease and an explicit interrupted finalization path. When no owner is alive, preserve the attempted workspace/logs and finalize it as interrupted/failed, or report a distinct terminal interrupted state. Do not automatically repeat a started model attempt or overwrite its evidence; that would introduce an unregistered retry.

Counterevidence/limit: ordinary command timeouts are caught and finalized. All planned candidates remain in the report, and no running attempt is counted as supported. README.md:105–107 now discloses the external-kill limitation.

## O3 — Verification combines protocol integrity with execution cleanliness

Priority: medium. Status: reporting/verification semantics boundary.

Evidence: `run.ts:174–180` saves stage evidence before throwing on a timed-out or failed model execution; generation/review then records a failed attempt. `run.ts:362–365` nevertheless makes every incomplete/failed stage event stream a verification error, and `run.ts:399–403` makes verification fail. In contrast, `report.ts:20–29` deliberately retains failed attempts as completed experimental accounting.

Concrete counterexample: a model hits the common deadline, with a passed context audit, unchanged inputs and fully retained logs. The run is correctly recorded as failed in the planned denominator. Verification still exits unsuccessfully because the stage did not complete cleanly, even though recording that failed outcome may be exactly the intended protocol behavior.

Minimum correction for a later protocol: expose separate provenance/accounting integrity and execution-completion fields. A faithfully recorded failed attempt can satisfy provenance checks while remaining a failed delivery/review outcome. A context, input-integrity or linkage failure should remain distinguishable from that ordinary negative observation. Alternatively, rename the existing aggregate to make “every execution was clean” explicit and add a separate integrity result.

Counterevidence/limit: this does not inflate supported counts or hide a failure. It can make “verification failed” ambiguous and should be explained when presenting an otherwise complete experiment containing timeouts.

## Independence and blinding assessment

For macOS mode, the critics have separate workspaces and fresh ephemeral CLI sessions, and neither is given the other's output (`run.ts:279–310`; `runner/protocol.ts:42–56`). A bookkeeping repair receives only its own predecessor plus structural warnings, not the other critic's conclusions. The adjudicator receives the combined proposals in another fresh session.

The source-first adjudicator order is an instruction, not an enforced temporal gate: CRITIQUE.json already exists when the session starts (`run.ts:283`; `protocol.ts:101–107`). README.md:56–59 accurately acknowledges this. Two critics using the same model family remain susceptible to correlated errors; session independence is not independent-model consensus.

Condition mappings and control metadata stay outside reviewer packages. Prose masks explicit guidance/release names (`run.ts:260`), while exact source bytes remain intact. A source comment or unmasked phrasing can still reveal authorship clues. README.md:87–91 correctly limits the blinding claim; no architecture or library choice can be used as evidence of superior quality.

Audit-only mode has no OS filesystem isolation (`runner/context.ts:13`) and should not be represented as equivalent to the reviewed macOS boundary. README.md:109–115 now states that limitation. Loopback context preflight is evidence about local request construction, not a saved copy of the remote request.

## What validation does and does not establish

The JSON schema and validator require complete obligation accounting, concrete reference locations, consistent dispositions and nonempty necessary-correction descriptions. They do not establish that the cited code proves the claim, that a reviewer actually read every file, that a counterexample is reachable, or that the minimum correction is correct. Those remain the critic/adjudicator/supervisory source judgments.

Before this fix, purely structural contradictions could masquerade as coherent assessments. Rejecting those contradictions improves the review record without converting code quality into a regex, test total, preferred pattern or numeric score. API/CHANGE-only evidence can legitimately reject an out-of-scope claim; it cannot substitute for implementation evidence in a supported conformance judgment.

Validation performed by this auditor:

- `bun test benchmarks/change/validate.test.ts`: 8 passing tests, 20 assertions, 0 failures.
- `bun run benchmark:typecheck`: passed after the test fixture's indexed-access annotations were corrected.
- Static inspection of the final harness changes and comparison with the initially identified gaps.

These tests exercise bookkeeping documents and temporary source references. They do not execute any candidate implementation or assign a quality outcome.

