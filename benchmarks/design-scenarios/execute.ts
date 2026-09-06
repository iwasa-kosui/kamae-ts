import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { auditContext, isolationPrefix, verifySandbox } from "../runner/context";
import { selectedPackage } from "../runner/dependencies";
import { copyTree, files, hashes, json, read, skillOverrides } from "../runner/files";
import { command, interrupted, parseEvents, succeeded } from "../runner/process";
import { codexArgs, order, type Variant } from "../runner/protocol";
import { prepare, scenarioRoot } from "./pack";

const repo = resolve(scenarioRoot, "../..");
type Phase = "design" | "implementation" | "change";
type Config = { model: string; effort: string; output: string; timeoutSeconds: number; dryRun: boolean };
type Stage = Awaited<ReturnType<typeof command>> & ReturnType<typeof parseEvents>;
type Candidate = {
  id: string; caseId: string; variant: Variant; status: "planned" | "running" | "completed" | "incomplete";
  phase?: Phase; error?: string; stages: Partial<Record<Phase, Stage>>;
  audits: Partial<Record<Phase, Awaited<ReturnType<typeof auditContext>>>>;
  snapshots: Partial<Record<Phase, Record<string, string>>>;
};

export function options(args: string[]): Config {
  const config: Config = { model: "", effort: "medium", output: "", timeoutSeconds: 900, dryRun: false };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--dry-run") { config.dryRun = true; continue; }
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    if (key === "--model") config.model = value;
    else if (key === "--reasoning-effort") config.effort = value;
    else if (key === "--output") config.output = resolve(value);
    else if (key === "--timeout-seconds") config.timeoutSeconds = Number(value);
    else throw new Error(`Unknown option: ${key}`);
  }
  if (!config.output || (!config.dryRun && !config.model.trim())) throw new Error("--output and --model are required for execution");
  if (!["low", "medium", "high", "xhigh"].includes(config.effort)) throw new Error("Invalid reasoning effort");
  if (!Number.isInteger(config.timeoutSeconds) || config.timeoutSeconds < 1) throw new Error("Invalid timeout");
  return config;
}

export function task(base: string, phase: Phase, variant: Variant) {
  const shared = `Work only in this workspace with its supplied materials. Do not read parent
directories, personal instructions, other projects or runs, or external websites.
Do not commit, publish, or delegate. Choose reasonable options without asking for
preferences; library selection is authorized. Keep supplied task/host documents,
TypeScript configuration, and supplied instruction files unchanged.
`;
  const treatment = variant === "kamae"
    ? "Use $kamae at .agents/skills/kamae/SKILL.md and relevant guides. Only the supplied .agents/rules defaults apply; do not load personal rules.\n"
    : "";
  const phaseRules = phase === "design"
    ? "Write DESIGN.md only, except you may select exact registry versions in package.json dependencies. Do not install dependencies; they are installed after this phase.\n"
    : phase === "implementation"
      ? "Keep DESIGN.md, package.json, and bun.lock unchanged. The selected dependencies are installed. Write source under src/ and IMPLEMENTATION.md.\n"
      : "Keep DESIGN.md and IMPLEMENTATION.md as historical records. Update src/ and write CHANGE-NOTES.md. You may add exact runtime dependencies to package.json and install with bun install --ignore-scripts if necessary; keep other package fields unchanged.\n";
  return shared + treatment + phaseRules + "\n" + base;
}

export async function unchanged(workspace: string, fixed: Record<string, string>) {
  const current = await hashes(workspace);
  const changed = Object.entries(fixed).filter(([path, hash]) => current[path] !== hash).map(([path]) => path);
  if (changed.length) throw new Error(`Supplied/frozen inputs changed: ${changed.join(", ")}`);
}

export function report(candidates: Candidate[], dryRun: boolean) {
  return `# Design scenario execution

${dryRun ? "Dry run: no models invoked." : "Exploratory pilot: one candidate per condition and scenario; no calibrated grading."}

| Candidate | Scenario | Condition | Execution status | Last phase | Artifacts |
| --- | --- | --- | --- | --- | --- |
${candidates.map(c => `| ${c.id} | ${c.caseId} | ${c.variant} | ${c.status} | ${c.phase ?? "—"} | [files](${c.id}/) |`).join("\n")}

Execution status records artifact production and protocol integrity, not a skill
score or a functional eligibility gate. Incomplete candidates and partial source
remain available for evidence review. D7 requires an actual change. No acceptance
tests, candidate test pass counts, functional defect tallies, or totals are produced.
See results.json for errors and available usage. The v0.1 design rubric is uncalibrated.
`;
}

export async function execute(config: Config) {
  if (!config.dryRun && process.platform !== "darwin") throw new Error("Real execution requires the macOS isolation profile");
  await mkdir(dirname(config.output), { recursive: true });
  await mkdir(config.output);
  const output = await realpath(config.output);
  const packed = await prepare(join(output, "inputs"));
  const temporary = await realpath(await mkdtemp(join(tmpdir(), "design-workspaces-")));
  const candidates: Candidate[] = packed.cases.flatMap((entry, index) => order(index + 1).map((variant, v) => ({
    id: `c${String(index * 2 + v + 1).padStart(2, "0")}`, caseId: entry.id, variant,
    status: "planned", stages: {}, audits: {}, snapshots: {},
  })));
  const persist = async () => {
    await json(join(output, "results.json"), candidates);
    await writeFile(join(output, "execution.md"), report(candidates, config.dryRun));
  };
  let signature: string | undefined;
  try {
    const skill = join(output, "skill");
    await copyTree(join(repo, "skills/kamae"), join(skill, "skills/kamae"));
    await copyTree(join(repo, "rules"), join(skill, "rules"));
    await copyTree(scenarioRoot, join(output, "runtime-source/design-scenarios"));
    await copyTree(join(repo, "benchmarks/runner"), join(output, "runtime-source/runner"));
    const disabledSkills = await skillOverrides([
      join(homedir(), ".agents/skills"), join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills"),
      "/etc/codex/skills", join(tmpdir(), ".agents/skills"),
    ]);
    const version = config.dryRun ? null : await command(["codex", "--version"], repo, join(output, "codex-version"), 10000);
    if (version && !succeeded(version)) throw new Error("Codex unavailable");
    await command(["git", "rev-parse", "HEAD"], repo, join(output, "revision"), 10000);
    await json(join(output, "run-manifest.json"), {
      version: 1, createdAt: new Date().toISOString(), ...config, isolation: "macos",
      codexVersion: version ? (await read(join(output, "codex-version.stdout"))).trim() : null, bunVersion: Bun.version,
      revision: (await read(join(output, "revision.stdout"))).trim(),
      runner: await hashes(scenarioRoot), sharedUtilities: await hashes(join(repo, "benchmarks/runner")),
      skill: await hashes(skill), inputs: packed, disabledSkills,
      order: candidates.map(({ id, caseId, variant }) => ({ id, caseId, variant })),
      assessment: "Exploratory, uncalibrated; no automatic grader or functional eligibility gate",
      contextPolicy: "Per-phase loopback audit plus outer OS sandbox; not a capture of the remote request. Parent workspaces, reviewer materials, source repository and personal instructions are denied. Network remains available; not a container.",
    });
    await persist();
    const workspaces = candidates.map(c => join(temporary, c.id));
    for (const candidate of candidates) {
      if (interrupted()) break;
      const workspace = join(temporary, candidate.id), artifact = join(output, candidate.id);
      await mkdir(artifact);
      await copyTree(join(output, "inputs/generation", candidate.caseId, "initial"), workspace);
      await mkdir(join(workspace, "src"));
      if (candidate.variant === "kamae") {
        await copyTree(join(skill, "skills/kamae"), join(workspace, ".agents/skills/kamae"));
        await copyTree(join(skill, "rules"), join(workspace, ".agents/rules"));
      }
      const originalPackage = await read(join(workspace, "package.json"));
      const supplied = await hashes(workspace);
      let fixed = supplied;
      try {
        if (!config.dryRun) {
          const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], workspace, join(artifact, "toolchain"), 120000);
          if (!succeeded(install)) throw new Error("Toolchain installation failed");
        }
        const prefix = config.dryRun ? [] : await isolationPrefix("macos", artifact, workspace,
          [repo, output, ...workspaces.filter(path => path !== workspace)]);
        if (!config.dryRun) {
          await verifySandbox(prefix, workspace, artifact, join(temporary, "outside-probe"));
          // Check the actual held-out source, not just a possibly absent global file.
          const probes = [join(output, "inputs/review", candidate.caseId, "review/review.json"),
            join(output, "inputs/generation", candidate.caseId, "change/CHANGE.md")];
          const script = `const fs=require('node:fs');for(const p of ${JSON.stringify(probes)}){try{fs.readFileSync(p);throw Error('Held-out input readable');}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;}}`;
          const probe = await command([...prefix, "bun", "-e", script], workspace, join(artifact, "held-out-probe"), 10000);
          if (!succeeded(probe)) throw new Error("Held-out input isolation probe failed");
        }
        for (const phase of ["design", "implementation", "change"] as const) {
          candidate.phase = phase;
          if (phase === "change") {
            if (!config.dryRun) await copyTree(workspace, join(artifact, "initial"));
            await copyTree(join(output, "inputs/generation", candidate.caseId, "change"), workspace);
            const { "package.json": _, "bun.lock": __, ...rest } = await hashes(workspace);
            fixed = Object.fromEntries(Object.entries(rest).filter(([path]) => !path.startsWith("src/")));
          }
          const name = { design: "DESIGN-TASK.md", implementation: "IMPLEMENTATION-TASK.md", change: "CHANGE-TASK.md" }[phase];
          const input = task(await read(join(workspace, name)), phase, candidate.variant);
          await writeFile(join(artifact, `${phase}.prompt.md`), input);
          const args = codexArgs({ binary: "codex", model: config.model, effort: config.effort, workspace,
            finalMessage: join(artifact, `${phase}.final.md`), externalSandbox: !config.dryRun,
            disabledSkills: [...disabledSkills, join(workspace, ".agents/skills/kamae"), join(workspace, ".agents/skills/kamae/SKILL.md")] });
          await json(join(artifact, `${phase}.command.json`), [...prefix, ...args]);
          if (config.dryRun) continue;
          candidate.status = "running";
          console.log(`${candidate.id} ${candidate.caseId} ${candidate.variant}: ${phase}`);
          await persist();
          const audit = await auditContext(args, prefix, workspace, join(artifact, phase), input);
          candidate.audits[phase] = audit;
          const next = `${audit.instructionsSha256}:${audit.toolsSha256}`;
          if (signature && next !== signature) throw new Error("CLI base context changed across phases");
          signature = next;
          const execution = await command([...prefix, ...args], workspace, join(artifact, phase), config.timeoutSeconds * 1000, input);
          const events = parseEvents(await read(join(artifact, `${phase}.stdout`)));
          candidate.stages[phase] = { ...execution, ...events };
          await copyTree(workspace, join(artifact, `${phase}-snapshot`));
          candidate.snapshots[phase] = await hashes(join(artifact, `${phase}-snapshot`));
          if (!succeeded(execution) || !events.completed || events.failed || events.malformedLines) throw new Error(`${phase} did not complete cleanly`);
          const { "package.json": _, ...exceptPackage } = fixed;
          await unchanged(workspace, phase === "design" ? exceptPackage : fixed);
          if (phase === "design") {
            if (!(await read(join(workspace, "DESIGN.md"))).trim()) throw new Error("DESIGN.md missing");
            const extra = (await files(workspace)).filter(path => !(path in supplied) && path !== "DESIGN.md");
            if (extra.length) throw new Error(`Design wrote unexpected files: ${extra.join(", ")}`);
            selectedPackage(originalPackage, await read(join(workspace, "package.json")));
            const install = await command(["bun", "install", "--ignore-scripts"], workspace, join(artifact, "selected-dependencies"), 120000);
            if (!succeeded(install)) throw new Error("Selected dependency installation failed");
            fixed = await hashes(workspace);
          } else {
            const note = phase === "implementation" ? "IMPLEMENTATION.md" : "CHANGE-NOTES.md";
            if (!(await read(join(workspace, note))).trim() || !(await read(join(workspace, "src/index.ts"))).trim()) throw new Error(`Missing ${note} or src/index.ts; inspect partial source`);
            if (phase === "change") {
              selectedPackage(originalPackage, await read(join(workspace, "package.json")));
              await copyTree(workspace, join(artifact, "changed"));
              await command(["git", "diff", "--no-index", "--", "initial", "changed"], artifact, join(artifact, "change-diff"), 10000);
            }
          }
        }
        if (!config.dryRun) candidate.status = "completed";
      } catch (error) {
        candidate.status = "incomplete"; candidate.error = String(error);
        console.error(`${candidate.id}: ${candidate.error}`);
      } finally {
        await copyTree(workspace, join(artifact, "latest"));
        await persist();
      }
    }
  } finally {
    await persist();
    await rm(temporary, { recursive: true, force: true });
  }
  console.log(`Artifacts: ${output}`);
  return candidates;
}

if (import.meta.main) {
  if (process.argv.includes("--help")) console.log("Design pilot: --model MODEL --output NEW_DIRECTORY [--reasoning-effort medium] [--timeout-seconds 900] [--dry-run]");
  else execute(options(process.argv.slice(2))).then(results => {
    if (results.some(c => c.status === "incomplete")) process.exitCode = 1;
  }).catch(error => { console.error(String(error)); process.exitCode = 1; });
}
