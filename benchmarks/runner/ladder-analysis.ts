import ts from "typescript";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { files, hashes, json, read } from "./files";
import { succeeded } from "./process";
import type { RunResult } from "./run";

// Frozen standard API rates for this pilot; these are not Codex invoice amounts.
export const prices = {
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.5 },
  "gpt-5.5": { input: 5, cached: 0.5, output: 30 },
} as const;

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function usageMetrics(run: RunResult, model: keyof typeof prices) {
  const stages = [run.stages.design, run.stages.implementation];
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const complete = stages.every(stage => stage && valid(stage.usage?.input_tokens) && valid(stage.usage?.output_tokens));
  const input = complete ? stages.reduce((sum, stage) => sum + stage!.usage!.input_tokens!, 0) : null;
  const output = complete ? stages.reduce((sum, stage) => sum + stage!.usage!.output_tokens!, 0) : null;
  const cacheKnown = complete && stages.every(stage => valid(stage!.usage?.cached_input_tokens) &&
    stage!.usage!.cached_input_tokens! <= stage!.usage!.input_tokens!);
  const cached = cacheKnown ? stages.reduce((sum, stage) => sum + stage!.usage!.cached_input_tokens!, 0) : null;
  const price = prices[model];
  // A phase's cumulative input <=272K is a conservative bound on every request.
  const shortContextBound = complete && stages.every(stage => stage!.usage!.input_tokens! <= 272_000);
  const standardUsd = input !== null && output !== null && cached !== null
    ? ((input - cached) * price.input + cached * price.cached + output * price.output) / 1_000_000 : null;
  const usd = model !== "gpt-5.5" || shortContextBound ? standardUsd : null;
  const upperUsd = model === "gpt-5.5" && !shortContextBound && input !== null && output !== null && cached !== null
    ? ((input - cached) * price.input * 2 + cached * price.cached * 2 + output * price.output * 1.5) / 1_000_000 : standardUsd;
  return { complete, input, output, cached, uncached: input !== null && cached !== null ? input - cached : null,
    total: input !== null && output !== null ? input + output : null, apiEquivalentUsd: usd,
    standardApiEquivalentUsd: standardUsd, apiEquivalentUpperUsd: upperUsd,
    shortContextBound, seconds: stages.every(Boolean) ? stages.reduce((sum, stage) => sum + stage!.durationMs / 1000, 0) : null,
    toolCalls: stages.every(Boolean) ? stages.reduce((sum, stage) => sum + stage!.toolCalls, 0) : null };
}

export function sourceMetrics(source: string, path = "source.ts") {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let statements = 0, variableDeclarations = 0;
  const visit = (node: ts.Node) => {
    if (ts.isStatement(node) && !ts.isBlock(node)) statements++;
    if (ts.isVariableDeclaration(node)) variableDeclarations++;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { bytes: Buffer.byteLength(source, "utf8"),
    lines: source.length ? source.split("\n").length - Number(source.endsWith("\n")) : 0,
    statements, variableDeclarations };
}

async function measureSource(root: string) {
  const all = (await files(root)).filter(path => path.endsWith(".ts"));
  const result = { production: { files: 0, bytes: 0, lines: 0, statements: 0, variableDeclarations: 0 },
    tests: { files: 0, bytes: 0, lines: 0, statements: 0, variableDeclarations: 0 } };
  for (const path of all) {
    const target = /\.(test|spec)\.ts$/.test(path) ? result.tests : result.production;
    target.files++;
    const metrics = sourceMetrics(await read(join(root, path)), path);
    for (const key of ["bytes", "lines", "statements", "variableDeclarations"] as const) target[key] += metrics[key];
  }
  return result;
}

export async function analyze(inputs: string[]) {
  const rows: {
    model: keyof typeof prices; id: string; repetition: number; variant: RunResult["variant"];
    status: RunResult["status"]; error: string | null; successful: boolean;
    accepted: number; expected: number; typecheck: boolean | null; selfTests: boolean | null;
    dependencies: RunResult["dependencies"] | null; usage: ReturnType<typeof usageMetrics>;
    size: Awaited<ReturnType<typeof measureSource>>; sourceHashes: Record<string, string>;
    contextAudits: RunResult["contextAudits"] | null;
  }[] = [];
  let sharedInputs: string | undefined;
  const manifests = [];
  for (const input of inputs) {
    const manifest = JSON.parse(await read(join(input, "manifest.json")));
    if (!(manifest.model in prices) || manifest.dryRun) throw new Error("Expected a real pilot model run");
    const signature = JSON.stringify({ inputs: manifest.inputs, skill: manifest.skill, rules: manifest.rules,
      guidance: manifest.guidance, effort: manifest.effort, isolation: manifest.isolation,
      timeoutSeconds: manifest.timeoutSeconds, codexVersion: manifest.codexVersion });
    if (sharedInputs && sharedInputs !== signature) throw new Error("Model blocks have different frozen conditions");
    sharedInputs = signature;
    manifests.push({ model: manifest.model, case: manifest.case, createdAt: manifest.createdAt,
      revision: manifest.revision, runner: manifest.runner, inputs: manifest.inputs, skill: manifest.skill,
      rules: manifest.rules, guidance: manifest.guidance, effort: manifest.effort,
      isolation: manifest.isolation, codexVersion: manifest.codexVersion, order: manifest.order });
    const runs: RunResult[] = JSON.parse(await read(join(input, "results.json")));
    if (runs.some(run => run.status === "planned")) throw new Error("Wait for all planned runs to finish");
    for (const run of runs) {
      const expected = manifest.case.expectedTests;
      const successful = run.status === "completed" && run.integrity === true &&
        !!run.typecheck && succeeded(run.typecheck) && !!run.selfTests && succeeded(run.selfTests) &&
        !!run.acceptance && succeeded(run.acceptance) && run.acceptance.counts?.passed === expected;
      rows.push({ model: manifest.model as keyof typeof prices, id: run.id, repetition: run.repetition,
        variant: run.variant, status: run.status, error: run.error ?? null, successful,
        accepted: run.status === "completed" ? run.acceptance?.counts?.passed ?? 0 : 0, expected,
        typecheck: run.typecheck ? succeeded(run.typecheck) : null,
        selfTests: run.selfTests ? succeeded(run.selfTests) : null,
        dependencies: run.dependencies ?? null, usage: usageMetrics(run, manifest.model),
        size: await measureSource(join(input, run.id, "workspace/src")),
        sourceHashes: await hashes(join(input, run.id, "workspace/src")),
        contextAudits: run.contextAudits ?? null });
    }
  }
  if (new Set(rows.map(row => `${row.model}/${row.id}`)).size !== rows.length) throw new Error("Duplicate runs");
  const cells = [...new Set(rows.map(row => `${row.model}/${row.variant}`))].map(key => {
    const group = rows.filter(row => `${row.model}/${row.variant}` === key);
    const measured = group.filter(row => row.usage.complete);
    const value = (pick: (row: typeof rows[number]) => number | null) => median(measured.map(pick).filter((v): v is number => v !== null));
    return { key, planned: group.length, successful: group.filter(row => row.successful).length,
      accepted: group.reduce((sum, row) => sum + row.accepted, 0), expected: group.reduce((sum, row) => sum + row.expected, 0),
      measured: measured.length, knownContextCosts: measured.filter(row => row.usage.apiEquivalentUsd !== null).length,
      standardCosts: measured.filter(row => row.usage.standardApiEquivalentUsd !== null).length,
      medians: { totalTokens: value(row => row.usage.total),
        outputTokens: value(row => row.usage.output), apiEquivalentUsd: value(row => row.usage.apiEquivalentUsd),
        standardApiEquivalentUsd: value(row => row.usage.standardApiEquivalentUsd),
        apiEquivalentUpperUsd: value(row => row.usage.apiEquivalentUpperUsd),
        seconds: value(row => row.usage.seconds), productionBytes: value(row => row.size.production.bytes),
        productionLines: value(row => row.size.production.lines), statements: value(row => row.size.production.statements),
        testBytes: value(row => row.size.tests.bytes) } };
  });
  const pairs = rows.filter(row => row.variant === "kamae-ladder").map(treatment => {
    const control = rows.find(row => row.model === treatment.model && row.variant === "kamae" && row.repetition === treatment.repetition);
    const ratio = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? a / b : null;
    return { model: treatment.model, repetition: treatment.repetition,
      controlSuccessful: control?.successful ?? null, treatmentSuccessful: treatment.successful,
      tokenRatio: ratio(treatment.usage.total, control?.usage.total ?? null),
      byteRatio: control && treatment.usage.complete && control.usage.complete
        ? ratio(treatment.size.production.bytes, control.size.production.bytes) : null,
      costRatio: ratio(treatment.usage.apiEquivalentUsd, control?.usage.apiEquivalentUsd ?? null),
      standardCostRatio: ratio(treatment.usage.standardApiEquivalentUsd, control?.usage.standardApiEquivalentUsd ?? null) };
  });
  return { schemaVersion: 1, analysisSha256: createHash("sha256").update(await read(import.meta.path)).digest("hex"),
    typescriptVersion: ts.version, prices, costBasis: "Standard API-equivalent USD, not actual Codex billing; verified 2026-09-06",
    sizeDefinition: "Physical lines excluding a phantom trailing line; UTF-8 bytes; TS statements excluding blocks, variable declarations separately; .test.ts/.spec.ts are tests",
    manifests, rows, cells, pairs };
}

if (import.meta.main) {
  const [output, ...inputs] = process.argv.slice(2);
  if (!output || !inputs.length) throw new Error("Usage: bun run benchmarks/runner/ladder-analysis.ts OUTPUT_JSON INPUT_DIR...");
  const result = await analyze(inputs.map(path => resolve(path)));
  await mkdir(dirname(resolve(output)), { recursive: true });
  await json(resolve(output), result);
  console.log(JSON.stringify(result.cells, null, 2));
}
