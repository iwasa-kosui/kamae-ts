import { join } from "node:path";
import { json, read } from "../runner/files";
import { writeFile } from "node:fs/promises";

export async function renderReport(root: string) {
  const manifest = JSON.parse(await read(join(root, "manifest.json")));
  const records: any[] = [];
  for (const task of manifest.tasks) {
    const generated = JSON.parse(await read(join(root, "runs", task.candidate_id, "generation.json")) || '{"status":"planned"}');
    const reviewed = JSON.parse(await read(join(root, "reviews", task.candidate_id, "result.json")) || '{"status":"planned"}');
    const final = reviewed.status === "completed" ? JSON.parse(await read(join(root, "reviews", task.candidate_id, "final.json"))) : null;
    records.push({ ...task, generation: generated.status, review: reviewed.status, outcome: final?.outcome ?? null,
      findings: final?.findings ?? null, requirements: final?.requirements ?? null,
      generationError: generated.error, reviewError: reviewed.error,
      generationUsage: generated.stage?.events?.usage ?? null,
      generationDurationMs: generated.stage?.execution?.durationMs ?? null });
  }
  const groups = manifest.refs.flatMap((ref: string) => manifest.cases.map((caseId: string) => {
    const group = records.filter(record => record.ref === ref && record.caseId === caseId);
    return { ref, caseId, planned: group.length,
      generationCompleted: group.filter(record => record.generation === "completed").length,
      reviewCompleted: group.filter(record => record.review === "completed").length,
      supported: group.filter(record => record.outcome === "supported").length,
      correctionNeeded: group.filter(record => record.outcome === "correction_needed").length,
      unverified: group.filter(record => record.outcome === "unverified").length,
      failed: group.filter(record => record.generation === "failed" || record.review === "failed").length };
  }));
  const summary = { updatedAt: new Date().toISOString(),
    finished: records.every(record => record.generation === "failed" || ["completed", "failed"].includes(record.review)), groups, records };
  await json(join(root, "summary.json"), summary);
  const lines = ["# Implemented-change benchmark", "",
    "Primary outcomes are source-grounded agent judgments of actual changes. No test results, regex matches, architecture tokens or numeric quality totals assign an outcome.", "",
    "Every planned run remains visible. Supported means no necessary correction was established in the inspected contract, not proof of defect-freedom. Generation/review failures and unresolved assessments are separate.", "",
    "| Condition | Case | Planned | Generated | Reviewed | Supported | Correction needed | Unverified | Failed |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const group of groups) lines.push(`| ${group.ref} | ${group.caseId} | ${group.planned} | ${group.generationCompleted} | ${group.reviewCompleted} | ${group.supported} | ${group.correctionNeeded} | ${group.unverified} | ${group.failed} |`);
  lines.push("", "## Individual records", "", "| Anonymous ID | Disclosed condition / case / repetition | Generation | Review | Outcome |", "| --- | --- | --- | --- | --- |");
  for (const record of records) lines.push(`| ${record.candidate_id} | ${record.ref} / ${record.caseId} / ${record.repetition} | ${record.generation} | ${record.review} | ${record.outcome ? `[${record.outcome}](reviews/${record.candidate_id}/final.json)` : "—"} |`);
  lines.push("", "The condition mapping is disclosed only in this report/manifest, outside all review workspaces. Reviewers receive before/after source, the diff, fixed requirements and masked implementation prose. Two independent critics precede a fresh adjudicator. Duplicate claims are merged; unsupported claims are rejected. Same model family can retain correlated blind spots.", "",
    `Cases deliberately exercise specific update intentions; they are not a random sample of software projects. ${manifest.runs} repetitions per case support descriptive comparison across ${manifest.cases.length} cases, not a precise general ranking. Judge calibration uses known-correct/defective controls before experimental generation; all protocol/input hashes are frozen. No quality-dependent retries or model substitution.`, "",
    "[Manifest](manifest.json) · [Structured summary](summary.json) · [Frozen rubric](RUBRIC.md) · [Calibration signoff](calibration-signoff.json)");
  await writeFile(join(root, "report.md"), lines.join("\n") + "\n");
  return summary;
}
