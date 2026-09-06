import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyTree, hashes, json, read } from "../../runner/files";
import { command, parseJunit, succeeded } from "../../runner/process";
import type { RunResult } from "../../runner/run";

const [destination, ...inputs] = process.argv.slice(2);
if (!destination || !inputs.length) throw new Error("Usage: bun run probe.ts NEW_OUTPUT_DIR MODEL_OUTPUT_DIR...");
const output = resolve(destination);
await mkdir(output);
const temporary = await mkdtemp(join(tmpdir(), "ladder-email-probe-"));
const results = [];
try {
  for (const input of inputs) {
    const manifest = JSON.parse(await read(join(input, "manifest.json")));
    const runs: RunResult[] = JSON.parse(await read(join(input, "results.json")));
    if (runs.some(run => run.status === "planned")) throw new Error("Generation is still running");
    for (const run of runs) {
      const id = `${manifest.model}-${run.id}`;
      const result = { model: manifest.model, id: run.id, passed: 0, tests: 5, measured: false,
        sourceUnchanged: true, error: "" };
      results.push(result);
      if (run.status !== "completed") { result.error = "Generation incomplete; not measured"; continue; }
      const source = join(input, run.id, "workspace");
      const before = await hashes(join(source, "src"));
      const workspace = join(temporary, id), artifact = join(output, id);
      await mkdir(workspace); await mkdir(artifact);
      for (const file of ["package.json", "bun.lock", "tsconfig.json"]) await cp(join(source, file), join(workspace, file));
      await copyTree(join(source, "src"), join(workspace, "src"));
      const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], workspace, join(artifact, "install"), 120000);
      if (!succeeded(install)) { result.error = "Dependency installation failed"; continue; }
      await mkdir(join(workspace, "probes"));
      await cp(join(import.meta.dir, "email-probe.test.ts.txt"), join(workspace, "probes/email.test.ts"));
      const execution = await command(["bun", "test", "./probes", "--reporter=junit", `--reporter-outfile=${join(artifact, "probe.xml")}`],
        workspace, join(artifact, "probe"), 60000);
      const counts = parseJunit(await read(join(artifact, "probe.xml")), 5);
      result.measured = !!counts && !execution.timedOut && !execution.error && (counts.passed < 5 || succeeded(execution));
      result.passed = counts?.passed ?? 0;
      result.sourceUnchanged = JSON.stringify(before) === JSON.stringify(await hashes(join(source, "src")));
      if (!result.sourceUnchanged) throw new Error("Original source changed");
    }
  }
} finally {
  await json(join(output, "results.json"), results);
  await rm(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify(results, null, 2));
