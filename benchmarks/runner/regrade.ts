import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { copyTree, hashes, json, read } from "./files";
import { selectedPackage } from "./dependencies";
import { command, parseJunit, succeeded } from "./process";
import { report, type RunResult } from "./run";

// Re-evaluate all completed generations with one common grader, without model
// calls, source repairs, or overwriting the original results.
export async function regrade(input: string, acceptance: string, output: string) {
  input = resolve(input); acceptance = resolve(acceptance); output = resolve(output);
  const manifest = JSON.parse(await read(join(input, "manifest.json")));
  const expected = manifest.case.expectedTests;
  if (!Number.isInteger(expected) || expected < 1) throw new Error("Invalid expected test count");
  const results: RunResult[] = JSON.parse(await read(join(input, "results.json")));
  if (results.some(run => run.status === "planned")) throw new Error("Wait for generation to finish before regrading");
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  const temporary = await mkdtemp(join(tmpdir(), "kamae-regrade-"));
  const evidence: Record<string, unknown> = {};
  const originalResults = await read(join(input, "results.json"));
  const originalPackage = await read(join(input, "inputs/starter/package.json"));
  await copyTree(acceptance, join(output, "acceptance"));
  try {
    for (const run of results) {
      if (run.status !== "completed" || run.integrity !== true) continue;
      const workspace = join(input, run.id, "workspace");
      const before = await hashes(workspace);
      const grading = join(temporary, run.id), artifact = join(output, run.id);
      await mkdir(artifact);
      try {
        selectedPackage(originalPackage, await read(join(workspace, "package.json")));
        await copyTree(join(input, "inputs/starter"), grading);
        for (const name of ["package.json", "bun.lock"]) await cp(join(workspace, name), join(grading, name));
        await copyTree(join(workspace, "src"), join(grading, "src"));
        const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], grading,
          join(artifact, "install"), 120000);
        if (!succeeded(install)) throw new Error("Regrade dependency installation failed");
        run.typecheck = await command(["bun", "run", "typecheck"], grading, join(artifact, "typecheck"), 60000);
        run.selfTests = await command(["bun", "test", "./src"], grading, join(artifact, "self-tests"), 60000);
        await copyTree(join(output, "acceptance"), join(grading, "acceptance"));
        const execution = await command(["bun", "test", "./acceptance", "--reporter=junit",
          `--reporter-outfile=${join(artifact, "acceptance.xml")}`], grading, join(artifact, "acceptance"), 60000);
        const counts = parseJunit(await read(join(artifact, "acceptance.xml")), expected);
        run.acceptance = { ...execution, counts };
        if (!counts || execution.timedOut || execution.error || (counts.passed === expected && !succeeded(execution)))
          throw new Error("Incomplete regrade report");
      } catch (error) { run.status = "failed"; run.error = String(error); }
      const after = await hashes(workspace);
      const unchanged = JSON.stringify(before) === JSON.stringify(after);
      evidence[run.id] = { workspaceHashes: before, unchanged };
      if (!unchanged) { run.status = "failed"; run.error = "Original workspace changed during regrade"; }
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
    const resultsUnchanged = originalResults === await read(join(input, "results.json"));
    await json(join(output, "manifest.json"), { schemaVersion: 2, kind: "regrade", createdAt: new Date().toISOString(),
      input, originalResultsUnchanged: resultsUnchanged, case: manifest.case,
      acceptance: await hashes(join(output, "acceptance")), sources: evidence });
    await json(join(output, "results.json"), results);
    await writeFile(join(output, "report.md"), "Grading-only rerun: original generated files are linked below; no model calls or repairs.\n\n" +
      report(results, false, expected, relative(output, input)));
    if (!resultsUnchanged) throw new Error("Original result file changed during regrade");
  }
  return results;
}

if (import.meta.main) {
  const [input, acceptance, output, ...extra] = process.argv.slice(2);
  if (!input || !acceptance || !output || extra.length) {
    console.error("Usage: bun run benchmark:regrade INPUT_DIR ACCEPTANCE_DIR NEW_OUTPUT_DIR");
    process.exitCode = 1;
  } else {
    try {
      const results = await regrade(input, acceptance, output);
      if (results.some(run => run.status !== "completed" || !run.acceptance || !succeeded(run.acceptance) ||
          !run.typecheck || !succeeded(run.typecheck) || !run.selfTests || !succeeded(run.selfTests))) process.exitCode = 1;
    } catch (error) { console.error(String(error)); process.exitCode = 1; }
  }
}
