import { afterEach, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPack, prepare, scenarioRoot } from "./pack";

const temporary: string[] = [];
async function folder() {
  const path = await mkdtemp(join(tmpdir(), "design-scenario-check-"));
  temporary.push(path);
  return path;
}
async function fixture() {
  const root = join(await folder(), "inputs");
  await cp(scenarioRoot, root, { recursive: true });
  return root;
}
async function editReview(root: string, edit: (data: any) => void) {
  const path = join(root, "cases/asset-loans/review.json");
  const data = JSON.parse(await readFile(path, "utf8"));
  edit(data);
  await writeFile(path, JSON.stringify(data));
}
afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

test("all scenarios declare assessment coverage before generation", async () => {
  const pack = await buildPack();
  expect(pack.scenarios.map(item => item.metadata.id)).toEqual(["asset-loans", "wholesale-quotes", "parcel-dispatch"]);
  expect(pack.scenarios.reduce((sum, item) => sum + item.units.length, 0)).toBe(20);
  expect(pack.scenarios.reduce((sum, item) => sum + item.exclusions.length, 0)).toBe(1);
  expect(pack.scenarios.every(item => item.units.some(unit => unit.axis === "D7" && unit.phase === "change"))).toBe(true);
});

test("initial packets exclude future changes and every generation packet excludes reviewer evidence", async () => {
  const root = await fixture();
  await editReview(root, data => { data.units[0].meaning += " REVIEW_ONLY_SENTINEL"; });
  const change = join(root, "cases/asset-loans/CHANGE.md");
  await writeFile(change, (await readFile(change, "utf8")) + "\nFUTURE_CHANGE_SENTINEL\n");
  // Unlisted files must never enter a model-facing packet through directory copying.
  await writeFile(join(root, "cases/asset-loans/hidden-answer.md"), "HIDDEN_ANSWER_SENTINEL");
  const pack = await buildPack(root);
  const generation = pack.files.filter(file => file.audience === "generation");
  expect(generation.some(file => file.text.includes("REVIEW_ONLY_SENTINEL"))).toBe(false);
  expect(generation.some(file => file.text.includes("HIDDEN_ANSWER_SENTINEL"))).toBe(false);
  expect(generation.filter(file => file.phase === "initial").some(file => file.text.includes("FUTURE_CHANGE_SENTINEL"))).toBe(false);
  expect(generation.filter(file => file.phase === "change").some(file => file.text.includes("FUTURE_CHANGE_SENTINEL"))).toBe(true);
  const initial = generation.filter(file => file.path.startsWith("generation/asset-loans/initial/"));
  expect(initial.map(file => file.path.split("/").at(-1)).sort()).toEqual([
    "DESIGN-TASK.md", "HOST.md", "IMPLEMENTATION-TASK.md", "PRD.md", "bun.lock", "package.json", "tsconfig.json",
  ].sort());
});

test("preparation is deterministic, records hashes, and cannot overwrite or write into source", async () => {
  const root = await fixture(), output = await folder();
  const first = await prepare(join(output, "first"), root);
  const second = await prepare(join(output, "second"), root);
  expect(first).toEqual(second);
  expect(first.modelExecution).toBe(false);
  expect(first.status).toBe("prepared-only");
  for (const file of first.files) {
    const bytes = await readFile(join(output, "first", file.path));
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(file.sha256);
  }
  const manifest = await readFile(join(output, "first/manifest.json"), "utf8");
  await expect(prepare(join(output, "first"), root)).rejects.toThrow();
  expect(await readFile(join(output, "first/manifest.json"), "utf8")).toBe(manifest);
  await expect(prepare(join(root, "output"), root)).rejects.toThrow("outside authored");
  await symlink(root, join(output, "linked-inputs"));
  await expect(prepare(join(output, "linked-inputs/output"), root)).rejects.toThrow("outside authored");
});

test("reviewer changes alter reviewer hashes without altering generator inputs", async () => {
  const root = await fixture();
  const first = await buildPack(root);
  await editReview(root, data => { data.units[0].question += " Clarified observation."; });
  const second = await buildPack(root);
  expect(first.files.filter(file => file.audience === "generation")).toEqual(second.files.filter(file => file.audience === "generation"));
  expect(first.files.filter(file => file.audience === "review")).not.toEqual(second.files.filter(file => file.audience === "review"));
});

test.each([
  ["unknown requirement", (data: any) => { data.units[0].requirements = ["L999"]; }],
  ["future requirement in initial phase", (data: any) => { data.units[0].requirements = ["C1"]; }],
  ["missing axis", (data: any) => { data.units = data.units.filter((unit: any) => unit.axis !== "D1"); }],
  ["excluded and rated axis", (data: any) => { data.exclusions.push({ axis: "D1", phase: "initial", reason: "duplicate" }); }],
  ["duplicate unit", (data: any) => { data.units.push(data.units[0]); }],
  ["functional grader field", (data: any) => { data.expectedTests = 19; }],
] as const)("rejects %s", async (_name, edit) => {
  const root = await fixture();
  await editReview(root, edit);
  await expect(buildPack(root)).rejects.toThrow();
});

test("rejects path traversal and symlinked generation inputs", async () => {
  const root = await fixture();
  const suite = await readFile(join(root, "suite.json"), "utf8");
  await writeFile(join(root, "suite.json"), JSON.stringify({ version: 1, caseIds: ["../outside"] }));
  await expect(buildPack(root)).rejects.toThrow("identifier");
  await writeFile(join(root, "suite.json"), suite);
  const input = join(root, "cases/asset-loans/PRD.md");
  await rm(input);
  await symlink(join(scenarioRoot, "cases/asset-loans/PRD.md"), input);
  await expect(buildPack(root)).rejects.toThrow("regular file");
});
