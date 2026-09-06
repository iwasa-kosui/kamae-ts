import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { read } from "../../runner/files";
import { createHash } from "node:crypto";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

// Aggregate already-authored agent judgments. No source/test/string quality grader.
const root = import.meta.dir;
const manifest = JSON.parse(await read(join(root, "manifest.json")));
const records = [];
const inputHashes: Record<string, string> = {};
async function observed(path: string) {
  const raw = await read(join(root, path));
  inputHashes[path] = hash(raw);
  return raw;
}
for (const task of manifest.tasks) {
  const generated = JSON.parse(await observed(`runs/${task.candidate_id}/generation.json`) || '{"status":"planned"}');
  const primary = JSON.parse(await observed(`reviews/${task.candidate_id}/result.json`) || '{"status":"planned"}');
  const first = JSON.parse(await observed(`reviews/${task.candidate_id}/final.json`) || "null");
  const audit = JSON.parse(await observed(`supervisory-audits/full/${task.candidate_id}.json`) || "null");
  records.push({ ...task, generation: generated.status, primaryStatus: primary.status,
    primaryOutcome: first?.outcome ?? null, primaryFindings: first?.findings ?? null,
    auditOutcome: audit?.audit_outcome ?? null, auditedFindings: audit?.findings ?? null,
    auditDecisions: audit?.primary_finding_decisions ?? null, auditUncertainties: audit?.uncertainties ?? null,
    generationError: generated.error ?? null, primaryError: primary.error ?? null,
    implementationMs: generated.stage?.execution?.durationMs ?? null,
    implementationUsage: generated.stage?.events?.usage ?? null });
}
function counts(group: typeof records) {
  return { planned: group.length, generated: group.filter(row => row.generation === "completed").length,
    generationFailed: group.filter(row => row.generation === "failed").length,
    primaryCompleted: group.filter(row => row.primaryStatus === "completed").length,
    primaryFailed: group.filter(row => row.primaryStatus === "failed").length,
    primarySupported: group.filter(row => row.primaryStatus === "completed" && row.primaryOutcome === "supported").length,
    primaryCorrectionNeeded: group.filter(row => row.primaryStatus === "completed" && row.primaryOutcome === "correction_needed").length,
    audited: group.filter(row => row.auditOutcome !== null).length,
    supported: group.filter(row => row.auditOutcome === "supported").length,
    correctionNeeded: group.filter(row => row.auditOutcome === "correction_needed").length,
    unverified: group.filter(row => row.auditOutcome === "unverified").length };
}
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i]! : (sorted[i - 1]! + sorted[i]!) / 2;
};
const groups = manifest.refs.map((ref: string) => {
  const group = records.filter(row => row.ref === ref);
  return { ref, ...counts(group), cases: Object.fromEntries(manifest.cases.map((id: string) => [id, counts(group.filter(row => row.caseId === id))])),
    descriptiveImplementation: { medianMs: median(group.flatMap(row => row.implementationMs === null ? [] : [row.implementationMs])),
      medianOutputTokens: median(group.flatMap(row => typeof row.implementationUsage?.output_tokens === "number" ? [row.implementationUsage.output_tokens] : [])) } };
});
const totals = counts(records);
const complete = records.every(row => row.generation === "failed" ||
  (row.generation === "completed" && ["completed", "failed"].includes(row.primaryStatus) && row.auditOutcome !== null));
const summary = { recordedAt: new Date().toISOString(), complete, totals, groups, records, inputHashes,
  method: "Frozen source-change generation and three-stage primary assessment, followed by a disclosed uniform supplemental blind source audit after a false positive. No test or source-string quality scores.",
  limitation: "Selected cases, four stochastic repetitions per case/condition, one generator model. Supplemental auditors retain context across candidates. Supported means no necessary correction established, not proof of defect-freedom." };
await writeFile(join(root, "audited-summary.json"), JSON.stringify(summary, null, 2) + "\n");
const lines = ["# Implemented-change comparison: audited outcomes", "",
  complete ? "All planned attempts and available implementation audits are accounted for." : "Work is still in progress. Pending outcomes are not passing outcomes.", "",
  `${totals.generated}/${totals.planned} implementations delivered; ${totals.primaryCompleted} primary assessments completed, ${totals.primaryFailed} failed; ${totals.audited} supplemental source audits completed.`, "",
  "## Whole-change outcomes after supplemental source audit", "",
  "Cells show supported implementations / planned implementations. Correction-needed, unverified, and unaudited deliveries are never counted as supported. These are counts of agent judgments, not numeric architecture scores.", "",
  "| Condition | Intake | Recovery | Consumers | Supported / planned | Correction needed | Unverified | Audited |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
for (const group of groups) lines.push(`| ${group.ref} | ${manifest.cases.map((id: string) => `${group.cases[id].supported}/${group.cases[id].planned}`).join(" | ")} | ${group.supported}/${group.planned} | ${group.correctionNeeded} | ${group.unverified} | ${group.audited} |`);
lines.push("", "## Frozen primary assessments, preserved separately", "", "| Condition | Supported | Correction needed | Completed | Failed |", "| --- | --- | --- | --- | --- |");
for (const group of groups) lines.push(`| ${group.ref} | ${group.primarySupported} | ${group.primaryCorrectionNeeded} | ${group.primaryCompleted} | ${group.primaryFailed} |`);
lines.push("", "## Necessary corrections established by the supplemental audit", "");
let findings = 0;
for (const row of records) for (const finding of row.auditedFindings ?? []) {
  findings++;
  lines.push(`- **${row.candidate_id} (${row.ref}, ${row.caseId}, repetition ${row.repetition}) — ${finding.claim}** ${finding.consequence} Necessary correction: ${finding.minimal_correction} [Structured source audit](supervisory-audits/full/${row.candidate_id}.json).`);
}
if (!findings) lines.push("No necessary correction has been established in completed supplemental audits. This does not assert that unaudited or unverified cases are correct.");
lines.push("", "## Corrections to primary judgments", "");
let changes = 0;
for (const row of records) if (row.primaryStatus === "completed" && row.auditOutcome && row.auditOutcome !== row.primaryOutcome) {
  changes++;
  lines.push(`- ${row.candidate_id} (${row.ref}, ${row.caseId}): primary ${row.primaryOutcome ?? row.primaryStatus} → supplemental ${row.auditOutcome}. [Audit](supervisory-audits/full/${row.candidate_id}.json).`);
  for (const decision of row.auditDecisions ?? []) if (["rejected", "narrowed", "unresolved"].includes(decision.verdict)) lines.push(`  - ${decision.finding_id}: ${decision.verdict}. ${decision.reason}`);
}
if (!changes) lines.push("No outcome changes recorded so far.");
lines.push("", "## Supplemental assessments without a completed primary judgment", "");
const primaryFailures = records.filter(row => row.primaryStatus === "failed" && row.auditOutcome);
for (const row of primaryFailures) lines.push(`- ${row.candidate_id} (${row.ref}, ${row.caseId}): primary review failed; independent supplemental outcome ${row.auditOutcome}. No completed primary judgment was overturned. [Audit](supervisory-audits/full/${row.candidate_id}.json).`);
if (!primaryFailures.length) lines.push("None recorded.");
lines.push("", "The supplemental layer was added after C021's primary adjudicator accepted a false language-semantics claim. It applies to all delivered implementations, including primary supported and failed assessments, and preserves the frozen primary results. Its case-specialist auditors are blind to release assignments but retain context across candidates. It is a disclosed post-start extension, not a preregistered replacement of unfavorable results.", "",
  "## Descriptive implementation effort", "",
  "Elapsed time includes concurrent service/tool latency and excludes dependency preparation; output tokens are recorded model usage. These observations do not assign quality points or isolate maintenance cost.", "",
  "| Condition | Median implementation minutes | Median output tokens |", "| --- | --- | --- |");
for (const group of groups) lines.push(`| ${group.ref} | ${group.descriptiveImplementation.medianMs === null ? "pending" : (group.descriptiveImplementation.medianMs / 60000).toFixed(2)} | ${group.descriptiveImplementation.medianOutputTokens ?? "pending"} |`);
lines.push("", "## Evidence and limits", "",
  "The same fixed starters and product contracts were used with a no-skill baseline and exact v1.0.0–v1.4.0 guidance snapshots. Three cases exercise wire normalization across existing consumers, persisted carrier recovery, and restricted-capability consumers with alternate storage. Four repetitions per case/condition give descriptive evidence for these cases and this generator, not a universal release ranking or proof that an update has no benefit.", "",
  "Calibration identified all three known defective controls and accepted all three references, but it did not prevent a later false positive or incomplete enumeration of one cause's consequences. Concrete source challenges remain necessary. Test results, architecture tokens, module counts, and summed obligation labels are not quality scores.", "",
  "[Manifest](manifest.json) · [Structured audited summary](audited-summary.json) · [Calibration](calibration-report.md) · [Primary report](report.md) · [Supplemental protocol](supervisory-audits/PROTOCOL.md) · [Primary verification](verification.json) · [Audit bookkeeping verification](audit-verification.json) · [Packaging inspection](packaging-audit.json)");
await writeFile(join(root, "audited-report.md"), lines.join("\n") + "\n");
console.log(JSON.stringify({ complete, ...totals }));
