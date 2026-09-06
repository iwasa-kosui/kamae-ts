import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { read } from "../../runner/files";

// Verify the portable evidence export against archived bytes and authored outcomes.
// This is data-integrity/accounting verification, not implementation assessment.
const root = import.meta.dir, target = join(root, "../../change/experiments/2026-09-06");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const metadata = JSON.parse(await read(join(target, "metadata.json")));
const summary = JSON.parse(await read(join(target, "audited-summary.json")));
const originalManifestRaw = await read(join(root, "manifest.json"));
const originalManifest = JSON.parse(originalManifestRaw);
const { output, ...portableManifest } = originalManifest;
const issues: string[] = [], records = [];
if (metadata.originalManifestSha256 !== hash(originalManifestRaw) || !same(metadata.manifest, portableManifest)) issues.push("Portable manifest differs");
if (metadata.index.length !== 72 || new Set(metadata.index.map((row: any) => row.candidate_id)).size !== 72) issues.push("Missing or duplicate candidate");
for (const item of metadata.index) {
  const raw = await read(join(target, item.evidenceFile)), exported = JSON.parse(raw);
  const id = item.candidate_id, review = join(root, "reviews", id);
  if (hash(raw) !== item.sha256) issues.push(`${id}: exported file hash differs`);
  if (!same(exported.candidate, originalManifest.tasks.find((row: any) => row.candidate_id === id))) issues.push(`${id}: condition mapping differs`);
  const primaryRaw = await read(join(review, "final.json"));
  const auditRaw = await read(join(root, "supervisory-audits/full", `${id}.json`));
  const result = JSON.parse(await read(join(review, "result.json")));
  if (!same(exported.primaryAssessment, primaryRaw ? JSON.parse(primaryRaw) : null) || exported.primaryStatus !== result.status) issues.push(`${id}: primary outcome differs`);
  if (!same(exported.supplementalAssessment, JSON.parse(auditRaw))) issues.push(`${id}: supplemental assessment differs`);
  if (exported.originalArtifactHashes.supplementalAssessment !== hash(auditRaw)) issues.push(`${id}: audit hash differs`);
  for (const [path, source] of Object.entries<string>(exported.source)) {
    if (source !== await read(join(review, "package", path))) issues.push(`${id}/${path}: exported source differs`);
    if (hash(source) !== exported.originalArtifactHashes.source[path.replace(/^after\/src\//, "")]) issues.push(`${id}/${path}: source hash differs`);
  }
  const expectedSourceCount = Object.keys(result.packageHashes).filter(path => path.startsWith("after/src/")).length;
  if (Object.keys(exported.source).length !== expectedSourceCount) issues.push(`${id}: source inventory differs`);
  records.push({ id, ref: exported.candidate.ref, primaryStatus: exported.primaryStatus,
    primaryOutcome: exported.primaryAssessment?.outcome ?? null, auditOutcome: exported.supplementalAssessment.audit_outcome });
}
for (const group of summary.groups) {
  const actual = records.filter(row => row.ref === group.ref);
  if (actual.length !== group.planned || actual.filter(row => row.auditOutcome === "supported").length !== group.supported ||
    actual.filter(row => row.auditOutcome === "correction_needed").length !== group.correctionNeeded ||
    actual.filter(row => row.primaryStatus === "completed" && row.primaryOutcome === "supported").length !== group.primarySupported ||
    actual.filter(row => row.primaryStatus === "failed").length !== group.primaryFailed) issues.push(`${group.ref}: public summary differs from exported judgments`);
}
const value = { recordedAt: new Date().toISOString(), verified: issues.length === 0, candidates: records.length, issues,
  limitation: "Exact exported source, mapping, judgments and count consistency do not prove semantic correctness." };
await writeFile(join(target, "export-verification.json"), JSON.stringify(value, null, 2) + "\n");
console.log(JSON.stringify(value));
if (issues.length) process.exitCode = 1;
