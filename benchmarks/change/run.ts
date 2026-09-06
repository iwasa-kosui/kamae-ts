import { appendFile, cp, mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { auditContext, isolationPrefix, verifySandbox } from "../runner/context";
import { command, parseEvents, succeeded } from "../runner/process";
import { copyTree, files, hashes, read, skillOverrides } from "../runner/files";
import { codexArgs } from "../runner/protocol";
import { generationPrompt, plan, reviewPrompt, rubric, shuffle } from "./protocol";
import { responseSchema } from "./schema";
import { combineCritiques, reviewIssues } from "./validate";
import { renderReport } from "./report";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const protocolFiles = ["change/run.ts", "change/protocol.ts", "change/schema.ts", "change/validate.ts", "change/report.ts",
  "runner/context.ts", "runner/process.ts", "runner/files.ts", "runner/protocol.ts"];
async function protocolHashes(base: string) {
  return Object.fromEntries(await Promise.all(protocolFiles.map(async path => [path, hash(await read(join(base, path)))])));
}
async function json(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.pending`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
  await rename(temporary, path);
}

export function options(args: string[]) {
  const action = args[0];
  if (!["prepare", "calibrate", "generate", "review", "report", "verify"].includes(action ?? "")) throw Error("Expected prepare, calibrate, generate, review, report or verify");
  const result = { action: action!, output: "", model: "gpt-5.5", judgeModel: "gpt-5.5", effort: "medium", judgeEffort: "high",
    cases: "intake,recovery,consumers", refs: "baseline,v1.0.0,v1.1.0,v1.2.0,v1.3.0,v1.4.0",
    runs: 4, workers: 4, timeoutSeconds: 1200, seed: "change-benchmark-20260906-v1", dryRun: false, watch: false,
    isolation: "macos" as "macos" | "audit", binary: "codex" };
  const fields = { "--output": "output", "--model": "model", "--judge-model": "judgeModel", "--effort": "effort",
    "--judge-effort": "judgeEffort", "--cases": "cases", "--refs": "refs", "--runs": "runs", "--workers": "workers",
    "--timeout-seconds": "timeoutSeconds", "--seed": "seed", "--isolation": "isolation", "--codex-bin": "binary" } as const;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--dry-run") { result.dryRun = true; continue; }
    if (args[i] === "--watch") { result.watch = true; continue; }
    const field = fields[args[i] as keyof typeof fields];
    if (!field || !args[i + 1] || args[i + 1]!.startsWith("--")) throw Error(`Invalid option ${args[i]}`);
    const value = args[++i]!;
    if (["runs", "workers", "timeoutSeconds"].includes(field)) (result as any)[field] = Number(value);
    else (result as any)[field] = value;
  }
  if (!result.output) throw Error("--output is required");
  for (const [name, maximum] of [["runs", 20], ["workers", 12], ["timeoutSeconds", 7200]] as const)
    if (!Number.isInteger(result[name]) || result[name] < 1 || result[name] > maximum) throw Error(`Invalid ${name}`);
  if (!["macos", "audit"].includes(result.isolation)) throw Error("Invalid isolation");
  for (const key of ["effort", "judgeEffort"] as const) if (!["low", "medium", "high", "xhigh"].includes(result[key])) throw Error(`Invalid ${key}`);
  const refs = result.refs.split(","), cases = result.cases.split(",");
  if (!refs.length || new Set(refs).size !== refs.length || refs.some(ref => !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(ref))) throw Error("Invalid refs");
  if (!cases.length || new Set(cases).size !== cases.length || cases.some(id => !/^[a-z][a-z0-9-]*$/.test(id))) throw Error("Invalid cases");
  return { ...result, output: resolve(result.output), refs, cases };
}
type Options = ReturnType<typeof options>;

async function pool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    for (;;) { const next = index++; if (next >= items.length) return; await fn(items[next]!); }
  }));
}
async function prepare(config: Options) {
  await mkdir(dirname(config.output), { recursive: true });
  await mkdir(config.output);
  const snapshots: Record<string, unknown> = {}, caseData: Record<string, any> = {};
  for (const caseId of config.cases) {
    const source = join(here, "cases", caseId), target = join(config.output, "inputs", caseId);
    const data = JSON.parse(await read(join(source, "case.json")));
    if (data.id !== caseId || !data.requirements?.length || new Set(data.requirements.map((req: any) => req.id)).size !== data.requirements.length) throw Error(`Invalid case ${caseId}`);
    await mkdir(target, { recursive: true });
    await copyTree(join(source, "starter"), join(target, "starter"));
    for (const name of ["CHANGE.md", "case.json"]) await cp(join(source, name), join(target, name));
    for (const name of ["API.md", "package.json", "bun.lock", "tsconfig.json", "src/index.ts"])
      if (!(await read(join(target, "starter", name))).trim()) throw Error(`Missing ${caseId}/${name}`);
    await copyTree(join(source, "controls"), join(config.output, "control-inputs", caseId));
    caseData[caseId] = { ...data, hashes: await hashes(target), controlHashes: await hashes(join(config.output, "control-inputs", caseId)) };
  }
  for (const ref of config.refs.filter(ref => ref !== "baseline")) {
    const folder = join(config.output, "skills", ref.replaceAll("/", "_"));
    await mkdir(folder, { recursive: true });
    const commit = await command(["git", "rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], repo, join(folder, "revision"), 10000);
    if (!succeeded(commit)) throw Error(`Unknown ref ${ref}`);
    const revision = (await read(join(folder, "revision.stdout"))).trim();
    const archive = await command(["git", "archive", "--output", join(folder, "snapshot.tar"), revision, "skills/kamae", "rules"], repo, join(folder, "archive"), 10000);
    if (!succeeded(archive)) throw Error(`Cannot archive ${ref}`);
    const extract = await command(["tar", "-xf", join(folder, "snapshot.tar"), "-C", folder], repo, join(folder, "extract"), 10000);
    if (!succeeded(extract)) throw Error(`Cannot extract ${ref}`);
    snapshots[ref] = { revision, folder: ref.replaceAll("/", "_"), skill: await hashes(join(folder, "skills/kamae")), rules: await hashes(join(folder, "rules")) };
  }
  await writeFile(join(config.output, "RUBRIC.md"), rubric);
  for (const path of protocolFiles) {
    const target = join(config.output, "protocol-source", path);
    await mkdir(dirname(target), { recursive: true }); await cp(join(repo, "benchmarks", path), target);
  }
  const tasks = plan(config.cases, config.refs, config.runs, config.seed);
  const controls = shuffle(config.cases.flatMap(caseId => ["reference", "broken"].map(variant => ({ caseId, variant }))), config.seed + "/controls")
    .map((task, index) => ({ ...task, candidate_id: `K${String(index + 1).padStart(3, "0")}` }));
  const version = await command([config.binary, "--version"], repo, join(config.output, "codex-version"), 10000);
  if (!config.dryRun && !succeeded(version)) throw Error("Codex unavailable");
  const manifest = { protocol: 1, createdAt: new Date().toISOString(), ...config,
    rubricHash: hash(rubric), generationPromptHashes: { baseline: hash(generationPrompt(false)), skill: hash(generationPrompt(true)) },
    reviewPromptHashes: Object.fromEntries(["critic-a", "critic-b", "adjudicator"].map(role => [role, hash(reviewPrompt(role as any, "ID"))])),
    caseData, skillSnapshots: snapshots, tasks, controls, runner: await protocolHashes(join(repo, "benchmarks")),
    schemaHashes: Object.fromEntries(config.cases.map(id => [id, [false, true].map(final => hash(JSON.stringify(responseSchema(final, caseData[id].requirements.map((req: any) => req.id)))))])),
    codexVersion: (await read(join(config.output, "codex-version.stdout"))).trim(), bunVersion: Bun.version,
    policy: "Freeze inputs and calibrate before generation. Same model/settings/deadline per condition. Independent critics precede adjudication. Quality is judged from actual source changes, not tests, strings, patterns or numeric totals. No quality-dependent retry or model substitution. Failed delivery/review stays in planned denominators. Context preflight is not capture of the remote request." };
  await json(join(config.output, "manifest.json"), manifest);
  await writeFile(join(config.output, "manifest.sha256"), hash(await read(join(config.output, "manifest.json"))));
  await renderReport(config.output);
  console.log(`Prepared ${tasks.length} changes and ${controls.length} blinded controls: ${config.output}`);
}

async function frozen(root: string, manifest: any) {
  if (hash(await read(join(root, "manifest.json"))) !== await read(join(root, "manifest.sha256"))) throw Error("Frozen manifest changed");
  for (const base of [join(repo, "benchmarks"), join(root, "protocol-source")])
    if (JSON.stringify(await protocolHashes(base)) !== JSON.stringify(manifest.runner)) throw Error("Frozen runner changed");
  if (hash(await read(join(root, "RUBRIC.md"))) !== manifest.rubricHash || hash(rubric) !== manifest.rubricHash) throw Error("Frozen rubric changed");
  for (const caseId of manifest.cases) {
    if (JSON.stringify(await hashes(join(root, "inputs", caseId))) !== JSON.stringify(manifest.caseData[caseId].hashes)) throw Error(`Frozen case changed: ${caseId}`);
    if (JSON.stringify(await hashes(join(root, "control-inputs", caseId))) !== JSON.stringify(manifest.caseData[caseId].controlHashes)) throw Error(`Frozen control changed: ${caseId}`);
    const schemas = [false, true].map(final => hash(JSON.stringify(responseSchema(final, manifest.caseData[caseId].requirements.map((req: any) => req.id)))));
    if (JSON.stringify(schemas) !== JSON.stringify(manifest.schemaHashes[caseId])) throw Error(`Frozen schema changed: ${caseId}`);
  }
  for (const [ref, snapshot] of Object.entries<any>(manifest.skillSnapshots)) {
    const folder = join(root, "skills", snapshot.folder);
    if (JSON.stringify(await hashes(join(folder, "skills/kamae"))) !== JSON.stringify(snapshot.skill) ||
        JSON.stringify(await hashes(join(folder, "rules"))) !== JSON.stringify(snapshot.rules)) throw Error(`Frozen skill changed: ${ref}`);
  }
  if (hash(generationPrompt(false)) !== manifest.generationPromptHashes.baseline || hash(generationPrompt(true)) !== manifest.generationPromptHashes.skill) throw Error("Generation prompt changed");
  for (const role of ["critic-a", "critic-b", "adjudicator"] as const)
    if (hash(reviewPrompt(role, "ID")) !== manifest.reviewPromptHashes[role]) throw Error(`Review prompt changed: ${role}`);
}

async function disabledSkills() {
  return skillOverrides([join(homedir(), ".agents/skills"), join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills"), "/etc/codex/skills", join(tmpdir(), ".agents/skills")]);
}
async function workspaceRoot(root: string) {
  const path = join(await realpath(tmpdir()), `change-benchmark-${hash(resolve(root)).slice(0, 20)}`);
  await mkdir(path, { recursive: true }); return path;
}
async function stage(root: string, manifest: any, workspace: string, artifact: string, name: string,
  input: string, model: string, effort: string, disabled: string[], hidden: string[], schema?: unknown) {
  await frozen(root, manifest);
  await mkdir(artifact, { recursive: true });
  if (schema) await json(join(workspace, "RESPONSE.schema.json"), schema);
  const before = await hashes(workspace);
  const prefix = await isolationPrefix(manifest.isolation, artifact, workspace, [repo, root, ...hidden]);
  if (manifest.isolation === "macos") {
    const sharedRoot = await workspaceRoot(root);
    await appendFile(join(artifact, "context.sb"), `(deny file-read-data (require-all (subpath ${JSON.stringify(sharedRoot)}) (require-not (subpath ${JSON.stringify(workspace)}))))\n`);
    await appendFile(join(artifact, "context.sb"), `(deny file-write* (subpath ${JSON.stringify(join(workspace, "node_modules"))}))\n`);
  }
  await cp(join(artifact, "context.sb"), join(artifact, `${name}.context.sb`)).catch(error => { if (manifest.isolation === "macos") throw error; });
  await verifySandbox(prefix, workspace, artifact, join(dirname(workspace), `${name}-outside-probe`));
  if (prefix.length) {
    const probe = join(await workspaceRoot(root), `${randomUUID()}.probe`);
    await writeFile(probe, "Other implementation context");
    try {
      const script = `import {readFileSync} from 'node:fs'; for(const path of ${JSON.stringify([probe, join(root, "RUBRIC.md")])}) {let blocked=false;try{readFileSync(path)}catch(error){blocked=error.code==='EPERM'||error.code==='EACCES'}if(!blocked)throw Error('Other experiment material was readable');} console.log('Other workspaces and experiment artifacts denied');`;
      const checked = await command([...prefix, "bun", "-e", script], workspace, join(artifact, `${name}.cross-context-probe`), 10000);
      if (!succeeded(checked)) throw Error("Cross-context isolation probe failed; no model invoked");
    } finally { await rm(probe, { force: true }); }
  }
  const args = codexArgs({ binary: manifest.binary, model, effort, workspace,
    finalMessage: join(artifact, `${name}.final${schema ? ".json" : ".md"}`), externalSandbox: manifest.isolation === "macos",
    disabledSkills: [...disabled, join(workspace, ".agents/skills/kamae"), join(workspace, ".agents/skills/kamae/SKILL.md")] });
  if (schema) args.splice(args.length - 1, 0, "--output-schema", join(workspace, "RESPONSE.schema.json"));
  await writeFile(join(artifact, `${name}.prompt.md`), input);
  await json(join(artifact, `${name}.command.json`), [...prefix, ...args]);
  const audit = await auditContext(args, prefix, workspace, join(artifact, name), input);
  const execution = await command([...prefix, ...args], workspace, join(artifact, name), manifest.timeoutSeconds * 1000, input);
  const events = parseEvents(await read(join(artifact, `${name}.stdout`)));
  const result = { audit, execution, events, inputHashes: before, integrity: schema ? JSON.stringify(before) === JSON.stringify(await hashes(workspace)) : null };
  await json(join(artifact, `${name}.stage.json`), result);
  if (!succeeded(execution) || !events.completed || events.failed || events.malformedLines) throw Error(`${name} did not complete cleanly`);
  if (schema && !result.integrity) throw Error(`${name} changed its review inputs`);
  return result;
}

async function generate(config: Options, manifest: any) {
  if (manifest.dryRun) throw Error("Dry-run manifests cannot invoke models");
  const signoff = JSON.parse(await read(join(config.output, "calibration-signoff.json")) || "null");
  if (!signoff?.accepted || signoff.rubricHash !== manifest.rubricHash) throw Error("Source-based calibration signoff required before experimental generation");
  if (signoff.manifestHash !== hash(await read(join(config.output, "manifest.json")))) throw Error("Calibration signoff refers to different experiment");
  for (const control of manifest.controls) {
    const folder = join(config.output, "calibration", control.candidate_id);
    if (JSON.parse(await read(join(folder, "result.json")) || "null")?.status !== "completed" ||
        signoff.reviewHashes?.[control.candidate_id] !== hash(await read(join(folder, "final.json")))) throw Error(`Unsigned calibration review: ${control.candidate_id}`);
  }
  const temp = await realpath(await mkdtemp(join(await workspaceRoot(config.output), "generation-")));
  const disabled = await disabledSkills();
  try {
    const prepared: Record<string, string> = {};
    for (const caseId of manifest.cases) {
      const target = join(temp, `dependencies-${caseId}`); prepared[caseId] = target;
      await copyTree(join(config.output, "inputs", caseId, "starter"), target);
      await mkdir(join(config.output, "installs"), { recursive: true });
      const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], target, join(config.output, "installs", caseId), 120000);
      if (!succeeded(install)) throw Error(`Dependency installation failed: ${caseId}`);
    }
    await pool(manifest.tasks, config.workers, async (task: any) => {
      const artifact = join(config.output, "runs", task.candidate_id), workspace = join(temp, task.candidate_id);
      if (await read(join(artifact, "generation.json"))) return;
      await mkdir(artifact, { recursive: true });
      const result: any = { status: "running", startedAt: new Date().toISOString() };
      await json(join(artifact, "generation.json"), result);
      try {
        await cp(prepared[task.caseId]!, workspace, { recursive: true });
        await cp(join(config.output, "inputs", task.caseId, "CHANGE.md"), join(workspace, "CHANGE.md"));
        if (task.ref !== "baseline") {
          const skill = join(config.output, "skills", manifest.skillSnapshots[task.ref].folder);
          await copyTree(join(skill, "skills/kamae"), join(workspace, ".agents/skills/kamae"));
          await copyTree(join(skill, "rules"), join(workspace, ".agents/rules"));
        }
        const original = await hashes(workspace);
        const immutable = Object.fromEntries(Object.entries(original).filter(([path]) => !path.startsWith("src/")));
        console.log(`${task.candidate_id}: implementing ${task.caseId}`);
        result.stage = await stage(config.output, manifest, workspace, artifact, "implementation", generationPrompt(task.ref !== "baseline"), manifest.model, manifest.effort, disabled,
          [...manifest.tasks.filter((other: any) => other.candidate_id !== task.candidate_id).map((other: any) => join(temp, other.candidate_id)), ...Object.values(prepared)]);
        const current = await hashes(workspace);
        if (Object.entries(immutable).some(([path, digest]) => current[path] !== digest)) throw Error("Implementation changed fixed inputs");
        if (Object.keys(current).some(path => !(path in original) && !path.startsWith("src/") && path !== "IMPLEMENTATION.md")) throw Error("Implementation wrote outside allowed source/notes");
        if (!(await read(join(workspace, "IMPLEMENTATION.md"))).trim()) throw Error("Missing implementation notes");
        result.integrity = true;
        result.typecheck = await command(["bun", "run", "typecheck"], workspace, join(artifact, "typecheck"), 60000);
        result.status = "completed";
      } catch (error) { result.status = "failed"; result.error = String(error); }
      finally {
        await copyTree(workspace, join(artifact, "workspace")).catch(error => { result.status = "failed"; result.error = `Artifact capture failed: ${error}`; });
        result.workspaceHashes = await hashes(join(artifact, "workspace")).catch(() => null);
        result.finishedAt = new Date().toISOString(); await json(join(artifact, "generation.json"), result);
        console.log(`${task.candidate_id}: generation ${result.status}${result.error ? `: ${result.error}` : ""}`);
      }
    });
  } finally { await rm(temp, { recursive: true, force: true }); }
}

const production = (path: string) => !/(?:^|\/)__tests__\//.test(path) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
async function bundle(folder: string, prefix: string) {
  const paths = (await files(folder)).filter(production);
  const blocks = await Promise.all(paths.map(async path => `## ${prefix}/${path}\n\n${(await read(join(folder, path))).split("\n").map((line, index) => `${index + 1}: ${line}`).join("\n")}\n`));
  return { paths: paths.map(path => `${prefix}/${path}`), text: blocks.join("\n") };
}
async function packageReview(root: string, task: any, control: boolean, artifact: string) {
  const target = join(artifact, "package"), caseRoot = join(root, "inputs", task.caseId);
  await mkdir(target, { recursive: true });
  await copyTree(join(caseRoot, "starter/src"), join(target, "before/src"));
  const candidate = control ? join(root, "control-inputs", task.caseId, task.variant) : join(root, "runs", task.candidate_id, "workspace");
  await copyTree(join(candidate, "src"), join(target, "after/src"));
  for (const path of await files(join(target, "after/src"))) if (!production(path)) await rm(join(target, "after/src", path));
  await cp(join(caseRoot, "starter/API.md"), join(target, "API.md"));
  await cp(join(caseRoot, "starter/package.json"), join(target, "package.json"));
  await cp(join(caseRoot, "starter/bun.lock"), join(target, "bun.lock"));
  await cp(join(caseRoot, "CHANGE.md"), join(target, "CHANGE.md"));
  await cp(join(root, "RUBRIC.md"), join(target, "RUBRIC.md"));
  const notes = (await read(join(candidate, "IMPLEMENTATION.md"))).replace(/kamae(?:-ts)?(?::kamae)?/gi, "[authoring guidance]").replace(/v1\.[0-4](?:\.0)?/g, "[release]");
  await writeFile(join(target, "IMPLEMENTATION.md"), notes);
  const before = await bundle(join(target, "before/src"), "before/src"), after = await bundle(join(target, "after/src"), "after/src");
  await writeFile(join(target, "BEFORE.md"), before.text); await writeFile(join(target, "AFTER.md"), after.text);
  const diff = await command(["diff", "-ru", "before", "after"], target, join(artifact, "source-diff"), 10000);
  if (diff.error || diff.timedOut || ![0, 1].includes(diff.exitCode ?? -1)) throw Error("Diff failed");
  await writeFile(join(target, "DIFF.patch"), await read(join(artifact, "source-diff.stdout")));
  return { target, productionFiles: [...before.paths, ...after.paths], hashes: await hashes(target) };
}

async function reviewOne(root: string, manifest: any, task: any, control: boolean, temp: string, disabled: string[]) {
  const artifact = join(root, control ? "calibration" : "reviews", task.candidate_id);
  if (await read(join(artifact, "result.json"))) return;
  await mkdir(artifact, { recursive: true });
  const result: any = { status: "running", stages: {}, startedAt: new Date().toISOString() };
  await json(join(artifact, "result.json"), result);
  try {
    const packaged = await packageReview(root, task, control, artifact); result.packageHashes = packaged.hashes;
    const requirements = manifest.caseData[task.caseId].requirements.map((req: any) => req.id);
    const run = async (role: "critic-a" | "critic-b" | "adjudicator", critique?: any, repair?: string[]) => {
      const name = repair ? `${role}-repair` : role, workspace = join(temp, `${task.candidate_id}-${name}`);
      await copyTree(packaged.target, workspace);
      await cp(join(temp, `dependencies-${task.caseId}`, "node_modules"), join(workspace, "node_modules"), { recursive: true });
      if (critique) await json(join(workspace, "CRITIQUE.json"), critique);
      let input = reviewPrompt(role, task.candidate_id);
      if (repair) {
        await json(join(workspace, "BOOKKEEPING.json"), repair);
        await cp(join(artifact, `${role}.final.json`), join(workspace, "PRIOR.json"));
        input += "\nPRIOR.json is your predecessor's assessment; BOOKKEEPING.json lists structural inconsistencies. Independently verify source and correct those inconsistencies, preserving justified findings. These warnings are not code-quality findings. Do not invent a defect to preserve a prior outcome.\n";
      }
      console.log(`${task.candidate_id}: ${name}`);
      const otherWorkspaces = [...manifest.tasks, ...manifest.controls].flatMap((item: any) => ["critic-a", "critic-b", "adjudicator", "critic-a-repair", "critic-b-repair", "adjudicator-repair"].map(stage => join(temp, `${item.candidate_id}-${stage}`))).filter(path => path !== workspace);
      result.stages[name] = await stage(root, manifest, workspace, join(artifact, name), name, input, manifest.judgeModel, manifest.judgeEffort, disabled, otherWorkspaces, responseSchema(role === "adjudicator", requirements));
      const raw = await read(join(artifact, name, `${name}.final.json`));
      await writeFile(join(artifact, `${name}.final.json`), raw);
      const doc = JSON.parse(raw);
      const issues = await reviewIssues(doc, task.candidate_id, requirements, workspace, packaged.productionFiles, critique);
      if (issues.length) {
        await json(join(artifact, `${name}.issues.json`), issues);
        if (repair) throw Error(`Unresolved review bookkeeping: ${issues.join("; ")}`);
        return { issues, doc };
      }
      return { issues: [] as string[], doc };
    };
    const critics = await Promise.all((["critic-a", "critic-b"] as const).map(async role => {
      const first = await run(role);
      return first.issues.length ? (await run(role, undefined, first.issues)).doc : first.doc;
    }));
    const combined = combineCritiques(critics[0], critics[1]);
    await json(join(artifact, "combined.json"), combined);
    const first = await run("adjudicator", combined);
    const final = first.issues.length ? (await run("adjudicator", combined, first.issues)).doc : first.doc;
    await json(join(artifact, "final.json"), final);
    result.status = "completed";
  } catch (error) { result.status = "failed"; result.error = String(error); }
  finally {
    result.finishedAt = new Date().toISOString(); await json(join(artifact, "result.json"), result);
    console.log(`${task.candidate_id}: review ${result.status}${result.error ? `: ${result.error}` : ""}`);
  }
}

async function review(config: Options, manifest: any, control: boolean) {
  if (manifest.dryRun) throw Error("Dry-run manifests cannot invoke models");
  const temp = await realpath(await mkdtemp(join(await workspaceRoot(config.output), "review-"))), disabled = await disabledSkills();
  const claimed = new Set<string>();
  try {
    for (const caseId of manifest.cases) {
      const target = join(temp, `dependencies-${caseId}`);
      await copyTree(join(config.output, "inputs", caseId, "starter"), target);
      await mkdir(join(config.output, "review-installs"), { recursive: true });
      const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], target, join(config.output, "review-installs", caseId), 120000);
      if (!succeeded(install)) throw Error(`Review dependencies unavailable: ${caseId}`);
      await rm(join(target, "src"), { recursive: true });
    }
    if (control) await pool(manifest.controls, config.workers, task => reviewOne(config.output, manifest, task, true, temp, disabled));
    else {
      await Promise.all(Array.from({ length: config.workers }, async () => {
        for (;;) {
          let next: any, pending = false;
          for (const task of manifest.tasks) {
            if (claimed.has(task.candidate_id) || await read(join(config.output, "reviews", task.candidate_id, "result.json"))) continue;
            const generation = JSON.parse(await read(join(config.output, "runs", task.candidate_id, "generation.json")) || '{"status":"planned"}');
            if (generation.status === "failed") continue;
            pending = true;
            if (generation.status === "completed" && !claimed.has(task.candidate_id)) { claimed.add(task.candidate_id); next = task; break; }
          }
          if (next) await reviewOne(config.output, manifest, next, false, temp, disabled);
          else if (pending && config.watch) await new Promise(resolve => setTimeout(resolve, 15000));
          else return;
        }
      }));
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function verify(root: string, manifest: any) {
  const errors: string[] = [], signatures = new Set<string>();
  let completedStages = 0;
  for (const group of ["runs", "reviews", "calibration"]) {
    const folder = join(root, group);
    let paths: string[] = [];
    try { paths = await files(folder); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    for (const path of paths.filter(path => path.endsWith(".stage.json"))) {
      const stage = JSON.parse(await read(join(folder, path)));
      if (!stage.audit?.passed || !stage.events?.completed || stage.events?.failed || stage.events?.malformedLines || stage.integrity === false) errors.push(`${group}/${path}: unclean stage`);
      signatures.add(`${stage.audit?.instructionsSha256}:${stage.audit?.toolsSha256}`); completedStages++;
    }
  }
  if (signatures.size > 1) errors.push("CLI base instruction/tool signatures differ");
  for (const task of manifest.tasks) {
    const folder = join(root, "runs", task.candidate_id);
    const generation = JSON.parse(await read(join(folder, "generation.json")) || "null");
    if (generation?.status === "completed" && JSON.stringify(await hashes(join(folder, "workspace"))) !== JSON.stringify(generation.workspaceHashes))
      errors.push(`${task.candidate_id}: archived implementation changed`);
  }
  for (const control of [true, false]) for (const task of control ? manifest.controls : manifest.tasks) {
    const folder = join(root, control ? "calibration" : "reviews", task.candidate_id);
    const result = JSON.parse(await read(join(folder, "result.json")) || "null");
    if (result?.status !== "completed") continue;
    const packaged = join(folder, "package"), actualHashes = await hashes(packaged);
    if (JSON.stringify(actualHashes) !== JSON.stringify(result.packageHashes)) errors.push(`${task.candidate_id}: review package changed`);
    const candidate = control ? join(root, "control-inputs", task.caseId, task.variant) : join(root, "runs", task.candidate_id, "workspace");
    for (const [side, source] of [["before", join(root, "inputs", task.caseId, "starter")], ["after", candidate]]) {
      const expected = Object.fromEntries(Object.entries(await hashes(join(source!, "src"))).filter(([path]) => side === "before" || production(path)));
      if (JSON.stringify(await hashes(join(packaged, side!, "src"))) !== JSON.stringify(expected)) errors.push(`${task.candidate_id}: ${side} source differs from original`);
    }
    const final = JSON.parse(await read(join(folder, "final.json"))), critique = JSON.parse(await read(join(folder, "combined.json")));
    const selected = (role: string) => result.stages[`${role}-repair`] ? `${role}-repair` : role;
    const rawReview = async (role: string) => { const name = selected(role); return JSON.parse(await read(join(folder, name, `${name}.final.json`))); };
    if (JSON.stringify(final) !== JSON.stringify(await rawReview("adjudicator"))) errors.push(`${task.candidate_id}: final differs from adjudicator output`);
    if (JSON.stringify(critique) !== JSON.stringify(combineCritiques(await rawReview("critic-a"), await rawReview("critic-b")))) errors.push(`${task.candidate_id}: combined critique differs from independent outputs`);
    const paths = Object.keys(actualHashes).filter(path => /^(before|after)\/src\//.test(path) && production(path));
    const issues = await reviewIssues(final, task.candidate_id, manifest.caseData[task.caseId].requirements.map((req: any) => req.id), packaged, paths, critique);
    errors.push(...issues.map(issue => `${task.candidate_id}: ${issue}`));
    for (const [name, saved] of Object.entries<any>(result.stages)) {
      if (Object.entries(actualHashes).some(([path, digest]) => saved.inputHashes[path] !== digest)) errors.push(`${task.candidate_id}/${name}: stage saw different package`);
    }
  }
  const summary = await renderReport(root);
  const value = { updatedAt: new Date().toISOString(), passed: !errors.length && summary.finished,
    finished: summary.finished, errors, completedStages, contextSignatures: [...signatures],
    limitation: "Provenance and bookkeeping checks do not score code quality or prove the truth of an agent assessment. Context audits are loopback preflights, not captured remote requests." };
  await json(join(root, "verification.json"), value); console.log(JSON.stringify(value));
  if (!value.passed) process.exitCode = 1;
}

async function main() {
  const config = options(process.argv.slice(2));
  if (config.action === "prepare") return prepare(config);
  const manifest = JSON.parse(await read(join(config.output, "manifest.json")));
  await frozen(config.output, manifest);
  if (config.action === "calibrate") await review(config, manifest, true);
  if (config.action === "generate") await generate(config, manifest);
  if (config.action === "review") await review(config, manifest, false);
  if (config.action === "verify") await verify(config.output, manifest);
  const summary = await renderReport(config.output);
  console.log(`Generated ${summary.records.filter(record => record.generation === "completed").length}/${summary.records.length}; reviewed ${summary.records.filter(record => record.review === "completed").length}/${summary.records.length}`);
}
if (import.meta.main) main().catch(error => { console.error(error); process.exitCode = 1; });
