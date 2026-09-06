import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const scenarioRoot = dirname(fileURLToPath(import.meta.url));
const axes = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"] as const;
type Axis = typeof axes[number];
type Phase = "initial" | "change";
type Unit = {
  id: string; axis: Axis; phase: Phase; requirements: string[];
  meaning: string; scope: string[]; question: string; counterevidence: string[];
};
type Exclusion = { axis: Axis; phase: "initial"; reason: string };
type Metadata = { version: 1; id: string; title: string; titleJa: string };
type Scenario = {
  metadata: Metadata; units: Unit[]; exclusions: Exclusion[];
  documents: Record<string, string>;
};
type Audience = "generation" | "review";
export type PackedFile = { path: string; text: string; audience: Audience; phase: Phase | "review" };
export type Pack = { scenarios: Scenario[]; files: PackedFile[] };

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: expected object`);
  const record = value as Record<string, unknown>;
  requireCondition(Object.keys(record).sort().join(",") === [...keys].sort().join(","), `${label}: unexpected or missing fields`);
  return record;
}
function string(value: unknown, label: string): string {
  requireCondition(typeof value === "string" && value.trim().length > 0, `${label}: expected nonempty string`);
  return value;
}
function strings(value: unknown, label: string): string[] {
  requireCondition(Array.isArray(value) && value.length > 0, `${label}: expected nonempty list`);
  return value.map((entry, i) => string(entry, `${label}[${i}]`));
}
function unique(values: string[], label: string) {
  requireCondition(new Set(values).size === values.length, `${label}: duplicate values`);
}
function identifier(value: unknown, label: string): string {
  const id = string(value, label);
  requireCondition(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id), `${label}: invalid identifier`);
  return id;
}
function axis(value: unknown): Axis {
  requireCondition(axes.some(item => item === value), "Unknown assessment axis");
  return value as Axis;
}
function within(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}
async function readText(root: string, path: string): Promise<string> {
  const full = join(root, path);
  requireCondition((await lstat(full)).isFile(), `Expected regular file: ${path}`);
  requireCondition(within(await realpath(root), await realpath(full)), `Input escapes source root: ${path}`);
  return string(await readFile(full, "utf8"), path);
}
function requirementIds(text: string): string[] {
  const ids = [...text.matchAll(/^### ([A-Z][0-9]+) — /gm)].map(match => match[1]!);
  requireCondition(ids.length > 0, "No requirement headings");
  unique(ids, "Requirement IDs");
  return ids;
}
async function loadScenario(root: string, id: string): Promise<Scenario> {
  const folder = `cases/${id}`;
  const meta = object(JSON.parse(await readText(root, `${folder}/case.json`)), ["version", "id", "title", "titleJa"], id);
  requireCondition(meta.version === 1 && meta.id === id, `${id}: invalid version or ID`);
  const metadata: Metadata = { version: 1, id, title: string(meta.title, "title"), titleJa: string(meta.titleJa, "titleJa") };
  const documents: Record<string, string> = {};
  for (const name of ["PRD.md", "HOST.md", "CHANGE.md", "HOST-CHANGE.md", "case.json", "review.json"]) {
    documents[name] = await readText(root, `${folder}/${name}`);
  }
  const initialIds = requirementIds(documents["PRD.md"]!);
  const changeIds = requirementIds(documents["CHANGE.md"]!);
  unique([...initialIds, ...changeIds], "Initial/change requirement IDs");
  const review = object(JSON.parse(documents["review.json"]!), ["caseId", "units", "exclusions"], `${id} review`);
  requireCondition(review.caseId === id && Array.isArray(review.units) && Array.isArray(review.exclusions), `${id}: invalid review`);
  const units = review.units.map((value): Unit => {
    const row = object(value, ["id", "axis", "phase", "requirements", "meaning", "scope", "question", "counterevidence"], "unit");
    const a = axis(row.axis);
    const phase = a === "D7" ? "change" : "initial";
    requireCondition(row.phase === phase, "D1–D6 apply to initial code; D7 requires a change");
    const refs = strings(row.requirements, "requirements");
    unique(refs, "Unit requirement references");
    const available = phase === "initial" ? initialIds : [...initialIds, ...changeIds];
    requireCondition(refs.every(ref => available.includes(ref)), "Unknown or premature requirement reference");
    if (phase === "change") requireCondition(refs.some(ref => changeIds.includes(ref)), "D7 needs a change requirement");
    return { id: identifier(row.id, "unit ID"), axis: a, phase, requirements: refs,
      meaning: string(row.meaning, "meaning"), scope: strings(row.scope, "scope"),
      question: string(row.question, "question"), counterevidence: strings(row.counterevidence, "counterevidence") };
  });
  unique(units.map(unit => unit.id), "Unit IDs");
  const exclusions = review.exclusions.map((value): Exclusion => {
    const row = object(value, ["axis", "phase", "reason"], "exclusion");
    const a = axis(row.axis);
    requireCondition(a !== "D7" && row.phase === "initial", "Only initial criteria can be excluded");
    return { axis: a, phase: "initial", reason: string(row.reason, "exclusion reason") };
  });
  unique(exclusions.map(item => item.axis), "Excluded axes");
  for (const a of axes) {
    const rated = units.some(unit => unit.axis === a), excluded = exclusions.some(item => item.axis === a);
    requireCondition(rated !== excluded, `${id}: ${a} must have units or an explicit exclusion, never both`);
  }
  return { metadata, units, exclusions, documents };
}

/** Assemble explicit input lists only. This module has no model or process invocation. */
export async function buildPack(root = scenarioRoot): Promise<Pack> {
  const suite = object(JSON.parse(await readText(root, "suite.json")), ["version", "caseIds"], "suite");
  requireCondition(suite.version === 1, "Unsupported suite version");
  const ids = strings(suite.caseIds, "caseIds").map(id => identifier(id, "case ID"));
  unique(ids, "Case IDs");
  const scenarios = await Promise.all(ids.map(id => loadScenario(root, id)));
  const common: Record<string, string> = {};
  for (const name of ["starter/package.json", "starter/bun.lock", "starter/tsconfig.json", "prompts/design.md", "prompts/implementation.md", "prompts/change.md", "rubric.md"]) {
    common[name] = await readText(root, name);
  }
  const starter = JSON.parse(common["starter/package.json"]!);
  requireCondition(starter.dependencies && Object.keys(starter.dependencies).length === 0, "Starter must have no runtime dependencies");
  const files: PackedFile[] = [];
  for (const scenario of scenarios) {
    const id = scenario.metadata.id;
    const add = (audience: Audience, phase: Phase | "review", name: string, text: string) => {
      files.push({ path: `${audience}/${id}/${phase}/${name}`, text, audience, phase });
    };
    for (const name of ["PRD.md", "HOST.md"]) add("generation", "initial", name, scenario.documents[name]!);
    for (const name of ["package.json", "bun.lock", "tsconfig.json"]) add("generation", "initial", name, common[`starter/${name}`]!);
    add("generation", "initial", "DESIGN-TASK.md", common["prompts/design.md"]!);
    add("generation", "initial", "IMPLEMENTATION-TASK.md", common["prompts/implementation.md"]!);
    for (const name of ["PRD.md", "HOST.md", "CHANGE.md", "HOST-CHANGE.md"]) add("generation", "change", name, scenario.documents[name]!);
    add("generation", "change", "CHANGE-TASK.md", common["prompts/change.md"]!);
    for (const [name, text] of Object.entries(scenario.documents)) add("review", "review", name, text);
    add("review", "review", "RUBRIC.md", common["rubric.md"]!);
  }
  unique(files.map(file => file.path), "Packed paths");
  return { scenarios, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

export async function prepare(output: string, root = scenarioRoot) {
  const requested = resolve(output);
  const pack = await buildPack(root);
  const target = join(await realpath(dirname(requested)), basename(requested));
  requireCondition(!within(await realpath(root), target), "Output must be outside authored scenario inputs");
  await mkdir(target); // Refuse existing outputs, including incomplete preparations.
  for (const file of pack.files) {
    const destination = join(target, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.text, { flag: "wx" });
  }
  const manifest = {
    version: 1, status: "prepared-only", modelExecution: false,
    cases: pack.scenarios.map(scenario => scenario.metadata),
    files: pack.files.map(({ path, text, audience, phase }) => ({ path, audience, phase,
      sha256: createHash("sha256").update(text).digest("hex") })),
  };
  await writeFile(join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  return manifest;
}
