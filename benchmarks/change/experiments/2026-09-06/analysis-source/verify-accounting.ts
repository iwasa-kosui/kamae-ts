import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { files, hashes, read } from "../../runner/files";

// Supplemental provenance/accounting check; never a candidate quality grader.
// Preserve the frozen verifier's stricter execution-cleanliness result separately.
const root = import.meta.dir;
const manifest = JSON.parse(await read(join(root, "manifest.json")));
const errors: string[] = [], pending: string[] = [], recordedExecutionFailures: unknown[] = [];
const signatures = new Set<string>();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const production = (path: string) => !/(?:^|\/)__tests__\//.test(path) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
let stages = 0, sourcePackages = 0;
for (const group of ["runs", "reviews", "calibration"]) {
  for (const path of (await files(join(root, group))).filter(path => path.endsWith(".stage.json"))) {
    const stage = JSON.parse(await read(join(root, group, path)));
    const candidate = path.split("/")[0];
    const result = JSON.parse(await read(join(root, group, candidate, group === "runs" ? "generation.json" : "result.json")));
    const label = `${group}/${path}`;
    stages++;
    if (stage.audit?.passed !== true) errors.push(`${label}: context preflight did not pass`);
    if (stage.integrity === false) errors.push(`${label}: changed review input`);
    if (stage.events?.malformedLines) errors.push(`${label}: malformed event lines`);
    signatures.add(`${stage.audit?.instructionsSha256}:${stage.audit?.toolsSha256}`);
    const clean = stage.events?.completed && !stage.events?.failed && !stage.execution?.timedOut && stage.execution?.exitCode === 0;
    if (!clean) {
      if (result.status === "failed") recordedExecutionFailures.push({ stage: label, execution: stage.execution, events: stage.events, recordedOutcome: result.status, recordedError: result.error });
      else if (result.status === "running") pending.push(`${label}: owner still running`);
      else errors.push(`${label}: failed execution has no failed owner record`);
    }
  }
}
if (signatures.size !== 1) errors.push("Base context signatures differ or are missing");
for (const task of manifest.tasks) {
  const folder = join(root, "runs", task.candidate_id);
  const generation = JSON.parse(await read(join(folder, "generation.json")) || "null");
  if (!generation || generation.status === "running") { pending.push(`${task.candidate_id}: generation pending`); continue; }
  if (!same(await hashes(join(folder, "workspace")), generation.workspaceHashes)) errors.push(`${task.candidate_id}: archived workspace differs`);
  if (generation.status === "completed" && generation.integrity !== true) errors.push(`${task.candidate_id}: completed generation lacks integrity confirmation`);
}
for (const control of [true, false]) for (const task of control ? manifest.controls : manifest.tasks) {
  const folder = join(root, control ? "calibration" : "reviews", task.candidate_id);
  const result = JSON.parse(await read(join(folder, "result.json")) || "null");
  if (!result || result.status === "running") { pending.push(`${task.candidate_id}: review pending`); continue; }
  const packaged = join(folder, "package");
  const actual = await hashes(packaged);
  if (!same(actual, result.packageHashes)) errors.push(`${task.candidate_id}: package differs from archived review input`);
  const after = control ? join(root, "control-inputs", task.caseId, task.variant) : join(root, "runs", task.candidate_id, "workspace");
  for (const [side, original] of [["before", join(root, "inputs", task.caseId, "starter")], ["after", after]]) {
    const expected = Object.fromEntries(Object.entries(await hashes(join(original!, "src"))).filter(([path]) => side === "before" || production(path)));
    if (!same(expected, await hashes(join(packaged, side!, "src")))) errors.push(`${task.candidate_id}: ${side} source differs from delivery`);
  }
  // Include the failed stage, which is absent from result.stages when stage() throws.
  for (const path of (await files(folder)).filter(path => path.endsWith(".stage.json"))) {
    const stage = JSON.parse(await read(join(folder, path)));
    if (Object.entries(actual).some(([name, digest]) => stage.inputHashes?.[name] !== digest)) errors.push(`${task.candidate_id}/${path}: stage saw a different package`);
  }
  sourcePackages++;
}
const summary = JSON.parse(await read(join(root, "audited-summary.json")) || "null");
if (!summary?.complete) pending.push("Supplemental assessment accounting is incomplete");
const value = { recordedAt: new Date().toISOString(), complete: pending.length === 0,
  provenanceAndAccountingValid: errors.length === 0 && pending.length === 0,
  allExecutionsClean: recordedExecutionFailures.length === 0, errors, pending,
  stages, sourcePackages, contextSignatures: [...signatures], recordedExecutionFailures,
  limitation: "Complements but does not override frozen verification.json. Bookkeeping, archived-source consistency and local context preflight are not code-quality judgments or proof of actual remote request contents." };
await writeFile(join(root, "accounting-verification.json"), JSON.stringify(value, null, 2) + "\n");
console.log(JSON.stringify({ ...value, recordedExecutionFailures: recordedExecutionFailures.length, contextSignatures: signatures.size, pending: pending.length }));
if (errors.length) process.exitCode = 1;
