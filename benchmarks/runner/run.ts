import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyTree, files, hashes, json, read, skillOverrides } from "./files";
import { command, interrupted, parseEvents, parseJunit, succeeded, type CommandResult } from "./process";
import { codexArgs, order, prompt, rubric, variants, type Phase, type Variant } from "./protocol";
import { auditContext, isolationPrefix, verifySandbox, type Isolation } from "./context";
import { selectedPackage } from "./dependencies";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function options(args: string[]) {
  const config = { case: "expense-approval", model: "", effort: "medium", runs: 3,
    timeoutSeconds: 900, output: "", dryRun: false, binary: "codex", isolation: "audit",
    variants: "baseline,kamae" };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--dry-run") { config.dryRun = true; continue; }
    const fields = { "--case": "case", "--model": "model", "--reasoning-effort": "effort",
      "--runs": "runs", "--timeout-seconds": "timeoutSeconds", "--output": "output",
      "--codex-bin": "binary", "--isolation": "isolation", "--variants": "variants" } as const;
    const field = fields[key as keyof typeof fields];
    if (!field) throw new Error(`Unknown option: ${key}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    if (field === "runs" || field === "timeoutSeconds") config[field] = Number(value);
    else config[field] = value;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.case)) throw new Error("Invalid case ID");
  const selectedVariants = config.variants.split(",");
  if (!selectedVariants.length || new Set(selectedVariants).size !== selectedVariants.length ||
      selectedVariants.some(value => !variants.includes(value as Variant))) throw new Error("Invalid variants");
  if (!config.dryRun && !config.model.trim()) throw new Error("--model is required for real runs");
  if (!["audit", "macos"].includes(config.isolation)) throw new Error("Invalid isolation mode");
  if (!["low", "medium", "high", "xhigh"].includes(config.effort)) throw new Error("Invalid reasoning effort");
  if (!Number.isInteger(config.runs) || config.runs < 1 || config.runs > 20) throw new Error("--runs must be 1–20");
  if (!Number.isInteger(config.timeoutSeconds) || config.timeoutSeconds < 1) throw new Error("Invalid timeout");
  config.output = resolve(config.output || join(repo, "benchmarks/results", new Date().toISOString().replaceAll(":", "-")));
  return { ...config, variants: selectedVariants as Variant[] };
}

type StageResult = CommandResult & ReturnType<typeof parseEvents>;
export type RunResult = {
  id: string; variant: Variant; repetition: number;
  status: "planned" | "completed" | "failed";
  error?: string;
  stages: Partial<Record<Phase, StageResult>>;
  integrity: boolean | null;
  typecheck?: CommandResult;
  selfTests?: CommandResult;
  acceptance?: CommandResult & { counts: ReturnType<typeof parseJunit> };
  sourceFiles?: number;
  sourceLines?: number;
  designReview: "pending";
  dependencies?: Record<string, string>;
  contextAudits?: Partial<Record<Phase, Awaited<ReturnType<typeof auditContext>>>>;
};

export function report(results: RunResult[], dryRun: boolean, expectedTests: number, artifactPrefix = ""): string {
  const rows = results.map(run => {
    const path = artifactPrefix ? `${artifactPrefix}/${run.id}` : run.id;
    const counts = run.acceptance?.counts;
    const stages = Object.values(run.stages);
    const seconds = stages.length ? (stages.reduce((sum, stage) => sum + stage.durationMs, 0) / 1000).toFixed(1) : "—";
    const tokens = stages.length && stages.every(stage => stage.usage)
      ? stages.reduce((sum, stage) => sum + (stage.usage?.input_tokens ?? 0) + (stage.usage?.output_tokens ?? 0), 0) : "—";
    return `| ${run.id} | ${run.status} | ${run.typecheck ? (succeeded(run.typecheck) ? "pass" : "fail") : "—"} | ${counts ? `${counts.passed}/${counts.tests}` : "—"} | ${seconds} / ${tokens} | ${run.sourceFiles ?? "—"} / ${run.sourceLines ?? "—"} | [design](${path}/DESIGN.md) · [implementation](${path}/workspace/IMPLEMENTATION.md) · [source](${path}/workspace/src) · [review](${path}/review.md) |`;
  });
  const summary = [...new Set(results.map(run => run.variant))].map(variant => {
    const runs = results.filter(run => run.variant === variant);
    // Incomplete/invalid runs remain in the denominator, never silently disappearing.
    const passed = runs.reduce((sum, run) => sum + (run.status === "completed" ? run.acceptance?.counts?.passed ?? 0 : 0), 0);
    return `| ${variant} | ${runs.filter(run => run.status === "completed").length}/${runs.length} | ${dryRun ? "not measured" : `${passed}/${runs.length * expectedTests}`} |`;
  });
  return `# PRD benchmark comparison

${dryRun ? "Dry run: prompts and inputs prepared; no model or grading executed." : "Same PRD, starter, model, and reasoning effort; only declared guidance differs."}

| Condition | Completed runs | Accepted checks (all planned runs) |
| --- | --- | --- |
${summary.join("\n")}

| Run | Status | Typecheck | Acceptance | Generation seconds / tokens | Source files / lines | Artifacts |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

See [results.json](results.json) for errors, phase duration, usage (when reported),
and exact check results; [manifest.json](manifest.json) records settings and hashes.
Generation success is distinct from passing acceptance. Source size is descriptive.
Human design review is pending: acceptance tests do not score architectural quality.
Use each review sheet to compare the frozen proposal against actual implementation.
One PRD and a few stochastic runs cannot establish general skill superiority.
`;
}

async function validateCase(caseRoot: string, caseId: string) {
  const metadata = JSON.parse(await read(join(caseRoot, "case.json")));
  if (metadata.id !== caseId || !Number.isInteger(metadata.expectedTests) || metadata.expectedTests < 1) {
    throw new Error("Invalid case metadata");
  }
  for (const name of ["prd.md", "starter/API.md", "starter/package.json", "starter/bun.lock", "starter/tsconfig.json"]) {
    if (!(await read(join(caseRoot, name))).trim()) throw new Error(`Missing case input: ${name}`);
  }
  const acceptance = await files(join(caseRoot, "acceptance"));
  if (!acceptance.some(path => path.endsWith(".test.ts"))) throw new Error("No acceptance tests");
  return metadata as { id: string; name: string; expectedTests: number };
}

async function checkIntegrity(workspace: string, starterHashes: Record<string, string>, design: string) {
  const current = await hashes(workspace);
  return Object.entries(starterHashes).every(([path, hash]) => current[path] === hash) &&
    await read(join(workspace, "DESIGN.md")) === design;
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("bun run benchmark --model MODEL [--case expense-approval] [--variants baseline,kamae|kamae,kamae-ladder] [--runs 3] [--reasoning-effort medium] [--timeout-seconds 900] [--output DIR] [--dry-run] [--codex-bin PATH] [--isolation audit|macos]");
    return;
  }
  const config = options(process.argv.slice(2));
  const caseRoot = join(repo, "benchmarks/cases", config.case);
  const metadata = await validateCase(caseRoot, config.case);
  await mkdir(dirname(config.output), { recursive: true });
  await mkdir(config.output); // Refuse to overwrite an existing run, including interrupted runs.
  const temporary = await realpath(await mkdtemp(join(tmpdir(), "kamae-benchmark-")));
  const results: RunResult[] = [];
  let contextSignature: string | undefined;
  const persist = async () => {
    await json(join(config.output, "results.json"), results);
    await writeFile(join(config.output, "report.md"), report(results, config.dryRun, metadata.expectedTests));
  };
  for (let repetition = 1; repetition <= config.runs; repetition++) {
    for (const variant of order(repetition, config.variants)) results.push({
      id: `${String(repetition).padStart(2, "0")}-${variant}`, variant, repetition,
      status: "planned", stages: {}, integrity: null, designReview: "pending",
    });
  }
  try {
    const disabledSkills = await skillOverrides([
      join(homedir(), ".agents/skills"), join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills"),
      "/etc/codex/skills", join(tmpdir(), ".agents/skills"),
    ]);
    const version = await command([config.binary, "--version"], temporary, join(config.output, "codex-version"), 10000);
    if (!config.dryRun && !succeeded(version)) throw new Error("Codex unavailable; see codex-version.stderr");
    await command(["git", "rev-parse", "HEAD"], repo, join(config.output, "revision"), 10000);
    const frozenCase = join(config.output, "inputs");
    const frozenSkill = join(config.output, "skill");
    await copyTree(caseRoot, frozenCase);
    await copyTree(join(repo, "skills/kamae"), join(frozenSkill, "skills/kamae"));
    await copyTree(join(repo, "rules"), join(frozenSkill, "rules"));
    if (config.variants.includes("kamae-ladder")) {
      await mkdir(join(config.output, "guidance"));
      await cp(join(repo, "benchmarks/guidance/ladder.md"), join(config.output, "guidance/LADDER.md"));
    }
    await json(join(config.output, "manifest.json"), {
      schemaVersion: 2, createdAt: new Date().toISOString(), ...config, case: metadata,
      codexVersion: (await read(join(config.output, "codex-version.stdout"))).trim(),
      bunVersion: Bun.version, revision: (await read(join(config.output, "revision.stdout"))).trim(),
      inputs: await hashes(frozenCase), skill: await hashes(join(frozenSkill, "skills/kamae")),
      rules: await hashes(join(frozenSkill, "rules")), runner: await hashes(join(repo, "benchmarks/runner")), disabledSkills,
      guidance: config.variants.includes("kamae-ladder") ? await hashes(join(config.output, "guidance")) : {},
      contextPolicy: "Every phase must pass a loopback initial-context preflight. User config, discovered skills, plugins/hooks/memory/web/subagents disabled. macos additionally denies personal instruction reads. This is not a container or a capture of the actual remote request.",
      order: results.map(run => run.id),
    });
    const prepared = join(temporary, "dependencies");
    await copyTree(join(frozenCase, "starter"), prepared);
    if (!config.dryRun) {
      const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], prepared,
        join(config.output, "install"), 120000);
      if (!succeeded(install)) throw new Error("Dependency installation failed; see install.stderr");
    }
    await persist();
    for (const run of results) {
      if (interrupted()) break;
      const artifact = join(config.output, run.id), workspace = join(temporary, run.id);
      await mkdir(artifact);
      await copyTree(prepared, workspace);
      await mkdir(join(workspace, "src"), { recursive: true });
      await writeFile(join(workspace, "PRD.md"), await read(join(frozenCase, "prd.md")));
      if (run.variant !== "baseline") {
        await copyTree(join(frozenSkill, "skills/kamae"), join(workspace, ".agents/skills/kamae"));
        await copyTree(join(frozenSkill, "rules"), join(workspace, ".agents/rules"));
      }
      if (run.variant === "kamae-ladder") await cp(join(config.output, "guidance/LADDER.md"), join(workspace, "LADDER.md"));
      // This also protects PRD and supplied skill/rule bytes from modification.
      let original = await hashes(workspace);
      const originalPackage = await read(join(workspace, "package.json"));
      await writeFile(join(artifact, "review.md"), rubric);
      if (!config.dryRun) await cp(join(prepared, "node_modules"), join(workspace, "node_modules"), { recursive: true });
      console.log(`${run.id}: ${config.dryRun ? "preparing" : "running"}`);
      try {
        let design = "";
        const prefix = await isolationPrefix(config.isolation as Isolation, artifact, workspace, [repo, config.output]);
        if (!config.dryRun) await verifySandbox(prefix, workspace, artifact, join(temporary, `${run.id}-outside-probe`));
        for (const phase of ["design", "implementation"] as const) {
          const input = prompt(phase, run.variant);
          await writeFile(join(artifact, `${phase}.prompt.md`), input);
          const args = codexArgs({ binary: config.binary, model: config.model, effort: config.effort,
            workspace, finalMessage: join(artifact, `${phase}.final.md`),
            externalSandbox: config.isolation === "macos",
            disabledSkills: [...disabledSkills, join(workspace, ".agents/skills/kamae"), join(workspace, ".agents/skills/kamae/SKILL.md")] });
          await json(join(artifact, `${phase}.command.json`), [...prefix, ...args]);
          if (config.dryRun) continue;
          run.contextAudits ??= {};
          const audit = await auditContext(args, prefix, workspace, join(artifact, phase), input);
          run.contextAudits[phase] = audit;
          const signature = `${audit.instructionsSha256}:${audit.toolsSha256}`;
          if (contextSignature && signature !== contextSignature) throw new Error("CLI base instructions or tool definitions changed between phases");
          contextSignature = signature;
          const execution = await command([...prefix, ...args], workspace, join(artifact, phase), config.timeoutSeconds * 1000, input);
          const events = parseEvents(await read(join(artifact, `${phase}.stdout`)));
          run.stages[phase] = { ...execution, ...events };
          if (!succeeded(execution) || !events.completed || events.failed || events.malformedLines) {
            throw new Error(`${phase} did not complete cleanly; inspect ${phase}.stderr and ${phase}.stdout`);
          }
          if (phase === "design") {
            design = await read(join(workspace, "DESIGN.md"));
            if (!design.trim()) throw new Error("Design phase produced no DESIGN.md");
            await writeFile(join(artifact, "DESIGN.md"), design);
            const { "package.json": _, ...fixedInputs } = original;
            if (!(await checkIntegrity(workspace, fixedInputs, design))) throw new Error("Design changed supplied inputs");
            run.dependencies = selectedPackage(originalPackage, await read(join(workspace, "package.json")));
            const additions = (await files(workspace)).filter(path => !(path in original) && path !== "DESIGN.md");
            if (additions.length) throw new Error(`Design phase wrote implementation files: ${additions.join(", ")}`);
            const install = await command(["bun", "install", "--ignore-scripts"], workspace,
              join(artifact, "selected-dependencies"), 120000);
            if (!succeeded(install)) throw new Error("Selected dependency installation failed");
            original = await hashes(workspace);
          }
        }
        if (!config.dryRun) {
          run.integrity = await checkIntegrity(workspace, original, design);
          if (!run.integrity) throw new Error("Implementation changed frozen design or supplied inputs");
          if (!(await read(join(workspace, "IMPLEMENTATION.md"))).trim()) throw new Error("Missing IMPLEMENTATION.md");
          if (!(await read(join(workspace, "src/index.ts"))).trim()) throw new Error("Missing src/index.ts");
          // Grade in a clean directory, with trusted configuration and post-generation tests.
          const grading = join(temporary, `${run.id}-grading`);
          await cp(prepared, grading, { recursive: true });
          await cp(join(workspace, "package.json"), join(grading, "package.json"));
          await cp(join(workspace, "bun.lock"), join(grading, "bun.lock"));
          const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], grading,
            join(artifact, "grading-dependencies"), 120000);
          if (!succeeded(install)) throw new Error("Grading dependency installation failed");
          await copyTree(join(workspace, "src"), join(grading, "src"));
          const sources = (await files(join(workspace, "src"))).filter(path => path.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(path));
          run.sourceFiles = sources.length;
          run.sourceLines = (await Promise.all(sources.map(path => read(join(workspace, "src", path)))))
            .reduce((sum, text) => sum + text.split("\n").length, 0);
          run.typecheck = await command(["bun", "run", "typecheck"], grading, join(artifact, "typecheck"), 60000);
          run.selfTests = await command(["bun", "test", "./src"], grading, join(artifact, "self-tests"), 60000);
          await copyTree(join(frozenCase, "acceptance"), join(grading, "acceptance"));
          const acceptance = await command(["bun", "test", "./acceptance", "--reporter=junit",
            `--reporter-outfile=${join(artifact, "acceptance.xml")}`], grading, join(artifact, "acceptance"), 60000);
          run.acceptance = { ...acceptance, counts: parseJunit(await read(join(artifact, "acceptance.xml")), metadata.expectedTests) };
          if (acceptance.timedOut || acceptance.error || !run.acceptance.counts ||
              (run.acceptance.counts.passed === metadata.expectedTests && !succeeded(acceptance))) {
            throw new Error("Acceptance did not produce a complete, consistent test report");
          }
          run.status = "completed";
        }
      } catch (error) {
        run.status = "failed"; run.error = String(error);
        console.error(`${run.id}: ${run.error}`);
      } finally {
        try { await copyTree(workspace, join(artifact, "workspace")); }
        catch (error) { run.status = "failed"; run.error = `${run.error ?? ""} Artifact capture: ${String(error)}`.trim(); }
        await persist();
      }
    }
  } finally {
    await persist(); await rm(temporary, { recursive: true, force: true });
  }
  console.log(`Report: ${join(config.output, "report.md")}`);
  if (results.some(run => run.status === "failed" || (run.status === "completed" &&
      (!run.typecheck || !succeeded(run.typecheck) || !run.selfTests || !succeeded(run.selfTests) ||
       !run.acceptance || !succeeded(run.acceptance) || run.acceptance.counts?.passed !== metadata.expectedTests)))) process.exitCode = 1;
}

if (import.meta.main) main().catch(error => { console.error(String(error)); process.exitCode = 1; });
