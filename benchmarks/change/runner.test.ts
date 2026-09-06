import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { options } from "./run";
import { generationPrompt, plan } from "./protocol";
import { read } from "../runner/files";

const temporary = await mkdtemp(join(tmpdir(), "change-runner-test-"));
afterAll(() => rm(temporary, { recursive: true, force: true }));

test("all conditions occur once per case/repetition and positions counterbalance globally", () => {
  const refs = ["baseline", "v1.0.0", "v1.1.0", "v1.2.0", "v1.3.0", "v1.4.0"];
  const tasks = plan(["intake", "recovery", "consumers"], refs, 4, "fixed");
  expect(tasks.length).toBe(72);
  expect(new Set(tasks.map(task => task.candidate_id)).size).toBe(72);
  expect(plan(["intake", "recovery", "consumers"], refs, 4, "fixed")).toEqual(tasks);
  for (let block = 0; block < 12; block++) {
    const group = tasks.slice(block * 6, block * 6 + 6);
    expect(group.map(task => task.ref).sort()).toEqual([...refs].sort());
    expect(new Set(group.map(task => `${task.caseId}/${task.repetition}`)).size).toBe(1);
  }
  for (const ref of refs) for (let position = 0; position < 6; position++)
    expect(tasks.filter((task, i) => i % 6 === position && task.ref === ref).length).toBe(2);
});

test("generation task differs only by supplied skill guidance", () => {
  const baseline = generationPrompt(false);
  expect(generationPrompt(true).replace("Use the $kamae skill at .agents/skills/kamae/SKILL.md and the supplied .agents/rules defaults.\n", "")).toBe(baseline);
  expect(() => options(["prepare", "--output", temporary, "--runs", "0"])).toThrow();
  expect(() => options(["prepare", "--output", temporary, "--refs", "baseline,baseline"])).toThrow();
  expect(() => options(["prepare", "--output", temporary, "--cases", "../escape"])).toThrow();
});

test("dry preparation freezes exact code/skill/cases and forbids model execution or changed inputs", async () => {
  const output = join(temporary, "experiment");
  const invoke = async (args: string[]) => {
    const proc = Bun.spawn(["bun", "run", "benchmarks/change/run.ts", ...args, "--output", output], {
      cwd: resolve(import.meta.dir, "../.."), stdout: "pipe", stderr: "pipe",
    });
    const [exit, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    return { exit, stdout, stderr };
  };
  expect((await invoke(["prepare", "--dry-run", "--runs", "1", "--refs", "baseline,HEAD", "--codex-bin", "missing-model-binary"])).exit).toBe(0);
  const manifest = JSON.parse(await read(join(output, "manifest.json")));
  expect(manifest.tasks.length).toBe(6);
  expect(manifest.controls.length).toBe(6);
  expect(manifest.skillSnapshots.HEAD.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(manifest.runner["runner/context.ts"]).toBeTruthy();
  expect((await invoke(["generate"])).stderr).toContain("Dry-run manifests cannot invoke models");
  const skill = join(output, "skills/HEAD/skills/kamae/SKILL.md");
  await writeFile(skill, await read(skill) + "\nChanged after freeze\n");
  expect((await invoke(["report"])).stderr).toContain("Frozen skill changed");
});
