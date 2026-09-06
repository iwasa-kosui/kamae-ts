import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { files, hashes, read } from "../../runner/files";
import { createHash } from "node:crypto";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

// Publish source and authored assessments, without deriving quality from code.
const root = import.meta.dir;
const target = join(root, "../../change/experiments/2026-09-06");
const summary = JSON.parse(await read(join(root, "audited-summary.json")));
const accounting = JSON.parse(await read(join(root, "accounting-verification.json")));
const auditVerification = JSON.parse(await read(join(root, "audit-verification.json")));
const primaryVerification = JSON.parse(await read(join(root, "verification.json")));
if (!summary.complete || !accounting.provenanceAndAccountingValid || !auditVerification.complete || !auditVerification.valid || !primaryVerification.finished) throw Error("Evidence is not complete and verified");
if (!summary.inputHashes) throw Error("Summary lacks a verified input snapshot");
for (const [path, digest] of Object.entries(summary.inputHashes))
  if (hash(await read(join(root, path))) !== digest) throw Error(`Summary is stale: ${path}`);
if (JSON.stringify(await hashes(join(root, "supervisory-audits"))) !== JSON.stringify(auditVerification.auditHashes))
  throw Error("Supplemental audit verification is stale");
const manifestRaw = await read(join(root, "manifest.json")), manifest = JSON.parse(manifestRaw);
const index = [];
await mkdir(join(target, "candidates"), { recursive: true });
await mkdir(join(target, "calibration"), { recursive: true });
for (const task of manifest.tasks) {
  const review = join(root, "reviews", task.candidate_id);
  const generationRaw = await read(join(root, "runs", task.candidate_id, "generation.json"));
  const generation = JSON.parse(generationRaw);
  if (generation.status !== "completed") throw Error(`${task.candidate_id}: this delivery exporter requires an actual completed implementation`);
  const resultRaw = await read(join(review, "result.json"));
  const result = JSON.parse(resultRaw);
  if (JSON.stringify(await hashes(join(review, "package"))) !== JSON.stringify(result.packageHashes))
    throw Error(`${task.candidate_id}: source package changed after review`);
  const primaryRaw = await read(join(review, "final.json"));
  const auditRaw = await read(join(root, "supervisory-audits/full", `${task.candidate_id}.json`));
  const source: Record<string, string> = {};
  for (const path of await files(join(review, "package/after/src"))) source[`after/src/${path}`] = await read(join(review, "package/after/src", path));
  const value = { candidate: task, generationStatus: generation.status, primaryStatus: result.status,
    primaryError: result.error ?? null, source,
    implementationNotes: await read(join(review, "package/IMPLEMENTATION.md")),
    primaryAssessment: primaryRaw ? JSON.parse(primaryRaw) : null,
    supplementalAssessment: JSON.parse(auditRaw),
    originalArtifactHashes: { generationResult: hash(generationRaw), primaryResult: hash(resultRaw), primaryAssessment: primaryRaw ? hash(primaryRaw) : null,
      supplementalAssessment: hash(auditRaw), source: await hashes(join(review, "package/after/src")) } };
  const output = JSON.stringify(value, null, 2) + "\n";
  await writeFile(join(target, "candidates", `${task.candidate_id}.json`), output);
  index.push({ ...task, evidenceFile: `candidates/${task.candidate_id}.json`, sha256: hash(output) });
}
for (const control of manifest.controls) {
  const raw = await read(join(root, "calibration", control.candidate_id, "final.json"));
  await writeFile(join(target, "calibration", `${control.candidate_id}.json`), JSON.stringify({ control, originalAssessmentSha256: hash(raw), assessment: JSON.parse(raw) }, null, 2) + "\n");
}
const { output: localOutputPath, ...portableManifest } = manifest;
const analysisSourceHashes: Record<string, string> = {};
await mkdir(join(target, "analysis-source"), { recursive: true });
for (const name of ["analyze.ts", "verify-audits.ts", "verify-accounting.ts", "inspect-packaging.ts", "exposure-audit.ts", "export-evidence.ts", "verify-export.ts"]) {
  const raw = await read(join(root, name));
  analysisSourceHashes[name] = hash(raw);
  await writeFile(join(target, "analysis-source", name), raw);
}
const metadata = { exportedAt: new Date().toISOString(), originalManifestSha256: hash(manifestRaw),
  manifest: portableManifest, analysisSourceHashes, executionOverrides: { generationWorkers: 6, primaryReviewWorkers: 6 },
  notes: "Manifest output path omitted from this portable copy. Worker counts above are the actual invocation settings; prepare saved its default of 4. Original raw files remain unchanged in the local experiment archive.", index };
await writeFile(join(target, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
const failureEvidence = [];
for (const failure of accounting.recordedExecutionFailures) {
  const stageRaw = await read(join(root, failure.stage));
  const stdoutRaw = await read(join(root, failure.stage.replace(/\.stage\.json$/, ".stdout")));
  const events = stdoutRaw.split("\n").filter(Boolean).map(line => JSON.parse(line));
  failureEvidence.push({ ...failure, originalStageSha256: hash(stageRaw), originalStdoutSha256: hash(stdoutRaw),
    errorEvents: events.filter(event => event.type === "error" || event.type === "turn.failed") });
}
await writeFile(join(target, "failed-stage-evidence.json"), JSON.stringify(failureEvidence, null, 2) + "\n");
for (const file of ["audited-summary.json", "accounting-verification.json", "audit-verification.json", "verification.json", "packaging-audit.json", "calibration-signoff.json", "fixture-verification.json", "RUBRIC.md", "calibration-report.md", "calibration-intake-audit.md", "calibration-recovery-audit.md", "calibration-consumers-audit.md"])
  await writeFile(join(target, file), await read(join(root, file)));
const exposureRaw = await read(join(root, "exposure-audit.json"));
const exposure = JSON.parse(exposureRaw);
await writeFile(join(target, "exposure-audit.json"), JSON.stringify({ ...exposure,
  originalArtifactSha256: hash(exposureRaw),
  records: exposure.records.map(({ matchingReadCommands, ...record }: any) => record),
  exportNote: "Shell command strings omitted from this portable delivery record; original command evidence remains in the local archive." }, null, 2) + "\n");
console.log(JSON.stringify({ candidates: index.length, controls: manifest.controls.length, target }));
