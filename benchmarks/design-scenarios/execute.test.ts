import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashes } from "../runner/files";
import { execute, options, report, task, unchanged } from "./execute";

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

test("execution requires explicit model and new output, rejects unsupported settings", () => {
  expect(() => options([])).toThrow();
  expect(() => options(["--output", "/tmp/test"])).toThrow();
  expect(options(["--dry-run", "--output", "/tmp/test"]).dryRun).toBe(true);
  for (const args of [["--timeout-seconds", "0"], ["--reasoning-effort", "unknown"], ["--case", "../other"]]) {
    expect(() => options(["--model", "gpt-5.5", "--output", "/tmp/test", ...args])).toThrow();
  }
});

test("the same stage prompt differs only by the declared skill instruction", () => {
  for (const phase of ["design", "implementation", "change"] as const) {
    const baseline = task("NEUTRAL TASK", phase, "baseline");
    const treatment = task("NEUTRAL TASK", phase, "kamae");
    expect(treatment.replace(/^Use \$kamae .*\n/m, "")).toBe(baseline);
    expect(baseline).not.toMatch(/DMMF|rubric|acceptance|kamae|Result|brand/);
    expect(baseline.endsWith("NEUTRAL TASK")).toBe(true);
  }
  expect(task("NEUTRAL", "change", "baseline")).toContain("Keep DESIGN.md and IMPLEMENTATION.md as historical records");
});

test("frozen inputs survive source edits but cannot be altered or deleted", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-freeze-")); temporary.push(root);
  await writeFile(join(root, "PRD.md"), "Frozen task");
  const fixed = await hashes(root);
  await writeFile(join(root, "generated.ts"), "export const value = 1;");
  await unchanged(root, fixed);
  await writeFile(join(root, "PRD.md"), "Changed task");
  await expect(unchanged(root, fixed)).rejects.toThrow("PRD.md");
  await rm(join(root, "PRD.md"));
  await expect(unchanged(root, fixed)).rejects.toThrow("PRD.md");
});

test("execution reporting preserves incomplete candidates without producing skill scores", () => {
  const markdown = report([{ id: "c01", caseId: "asset-loans", variant: "baseline",
    status: "incomplete", phase: "change", error: "timeout", stages: {}, audits: {}, snapshots: {} }], false);
  expect(markdown).toContain("c01 | asset-loans | baseline | incomplete | change");
  expect(markdown).toContain("partial source");
  expect(markdown).not.toContain("0/20");
});

test("dry run prepares six candidates without model stages and refuses reuse", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-execution-dry-")); temporary.push(root);
  const config = options(["--dry-run", "--output", join(root, "output")]);
  const candidates = await execute(config);
  expect(candidates.map(c => c.variant)).toEqual(["baseline", "kamae", "kamae", "baseline", "baseline", "kamae"]);
  expect(candidates.every(c => c.status === "planned" && Object.keys(c.stages).length === 0)).toBe(true);
  const run = JSON.parse(await readFile(join(config.output, "run-manifest.json"), "utf8"));
  expect(run.codexVersion).toBeNull();
  const firstPrompt = await readFile(join(config.output, "c01/design.prompt.md"), "utf8");
  expect(firstPrompt).not.toContain("Inspect equipment after return");
  const changePrompt = await readFile(join(config.output, "c01/change.prompt.md"), "utf8");
  expect(changePrompt).toContain("CHANGE.md");
  await expect(execute(config)).rejects.toThrow();
});
