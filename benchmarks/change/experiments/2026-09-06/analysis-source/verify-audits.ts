import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { files, hashes, read } from "../../runner/files";
import { reviewIssues } from "../../change/validate";

// Reference and consistency validation only. No candidate code is executed or scored.
const root = import.meta.dir;
const manifest = JSON.parse(await read(join(root, "manifest.json")));
const records = [];
for (const task of manifest.tasks) {
  const path = join(root, "supervisory-audits/full", `${task.candidate_id}.json`);
  const raw = await read(path);
  if (!raw) continue;
  const audit = JSON.parse(raw), reviewRoot = join(root, "reviews", task.candidate_id);
  const primaryRaw = await read(join(reviewRoot, "final.json"));
  const primary = primaryRaw ? JSON.parse(primaryRaw) : { findings: [] };
  const proposed = new Set(primary.findings.map((finding: any) => finding.id));
  // Adapt the supplemental S namespace to the existing validator's N namespace.
  // This only adapts IDs in memory; original evidence and judgments remain untouched.
  const fid = (id: string) => proposed.has(id) ? id : `N_${id}`;
  const doc = { candidate_id: audit.candidate_id, files_read: audit.files_read,
    requirements: audit.requirement_assessments.map((req: any) => ({ ...req, finding_ids: req.finding_ids.map(fid) })),
    findings: audit.findings.map((finding: any) => ({ ...finding, id: fid(finding.id) })),
    decisions: audit.primary_finding_decisions.map((decision: any) => ({ ...decision,
      duplicate_of: decision.duplicate_of === null ? null : fid(decision.duplicate_of) })),
    implemented_changes: [], preserved_consumers: [], outcome: audit.audit_outcome };
  const workspace = join(reviewRoot, "package");
  const sourcePaths = (await files(workspace)).filter(path => /^(before|after)\/src\//.test(path));
  const issues = await reviewIssues(doc, task.candidate_id, manifest.caseData[task.caseId].requirements.map((req: any) => req.id), workspace, sourcePaths, { findings: primary.findings });
  records.push({ candidate_id: task.candidate_id, issues });
}
const result = { recordedAt: new Date().toISOString(), inspected: records.length,
  complete: records.length === manifest.tasks.length, valid: records.every(record => !record.issues.length), records,
  auditHashes: await hashes(join(root, "supervisory-audits")),
  limitation: "Valid bookkeeping and source references do not prove semantic correctness." };
await writeFile(join(root, "audit-verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ inspected: result.inspected, complete: result.complete, valid: result.valid, issues: records.filter(record => record.issues.length) }));
if (!result.valid) process.exitCode = 1;
