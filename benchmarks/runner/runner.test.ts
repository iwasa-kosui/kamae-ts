import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { files, hashes, read, skillOverrides } from "./files";
import { command, parseEvents, parseJunit, succeeded } from "./process";
import { codexArgs, order, prompt } from "./protocol";
import { options, report, type RunResult } from "./run";
import { inspectContext } from "./context";
import { selectedPackage } from "./dependencies";
import { regrade } from "./regrade";

const temporary = await mkdtemp(join(tmpdir(), "kamae-runner-test-"));
afterAll(() => rm(temporary, { recursive: true, force: true }));

describe("comparison protocol", () => {
  test("requires a model, valid counts, and an unambiguous case ID", () => {
    for (const args of [[], ["--runs", "0"], ["--runs", "NaN"], ["--runs", "1.2"],
      ["--case", "../escape"], ["--what"], ["--model"], ["--timeout-seconds", "Infinity"]]) {
      expect(() => options(args)).toThrow();
    }
    expect(options(["--dry-run"]).model).toBe("");
    expect(options(["--model", "pinned-model", "--runs", "2"]).runs).toBe(2);
  });

  test("counterbalances run order and changes only skill instructions", () => {
    expect(order(1)).toEqual(["baseline", "kamae"]);
    expect(order(2)).toEqual(["kamae", "baseline"]);
    for (const phase of ["design", "implementation"] as const) {
      const treatment = prompt(phase, "kamae").split("\n").filter(line => !line.startsWith("Use the $kamae"));
      expect(treatment.join("\n")).toBe(prompt(phase, "baseline"));
      expect(prompt(phase, "baseline")).not.toContain("discriminated");
      expect(prompt(phase, "baseline")).not.toMatch(/state transitions|invariants|boundary validation|business failures|zod|neverthrow|pure functions/i);
    }
  });

  test("rejects undeclared initial context, even without known skill keywords", () => {
    const message = (role: string, text: string) => ({ role, content: [{ type: "input_text", text }] });
    const request = { instructions: "CLI defaults", tools: [], input: [
      message("developer", "<permissions instructions>Sandbox</permissions instructions>"),
      message("user", "<environment_context>cwd: /tmp/work</environment_context>"),
      message("user", "Task"),
    ] };
    expect(inspectContext(request, "Task").passed).toBe(true);
    expect(() => inspectContext({ ...request, input: [...request.input, message("user", "Prefer a particular architecture")] }, "Task")).toThrow("Unexpected");
    expect(() => inspectContext({ ...request, input: request.input.slice(1) }, "Different task")).toThrow();
    expect(() => inspectContext({ ...request, input: [...request.input, request.input[2]!] }, "Task")).toThrow();
  });

  test("allows library selection without changing execution configuration", () => {
    const original = JSON.stringify({ dependencies: {}, scripts: { test: "bun test" } });
    expect(selectedPackage(original, JSON.stringify({ dependencies: { zod: "4.1.5" }, scripts: { test: "bun test" } })))
      .toEqual({ zod: "4.1.5" });
    expect(() => selectedPackage(original, JSON.stringify({ dependencies: {}, scripts: { test: "true" } }))).toThrow();
    for (const version of ["latest", "file:/private", "https://example.com/a.tgz", "^1.0.0"]) {
      expect(() => selectedPackage(original, JSON.stringify({ dependencies: { pkg: version }, scripts: { test: "bun test" } }))).toThrow();
    }
  });

  test("uses stdin and explicit sandbox/config isolation without shell interpolation", () => {
    const args = codexArgs({ binary: "codex", model: "example-model", effort: "medium",
      workspace: "/tmp/with space", finalMessage: "/tmp/final.md", disabledSkills: ["/tmp/quote\"/skill"] });
    expect(args).toContain("--ignore-user-config");
    expect(args).toContain("workspace-write");
    expect(args).toContain("features.plugins=false");
    expect(args).toContain("project_doc_max_bytes=0");
    expect(args).toContain("skills.config=[{path=\"/tmp/quote\\\"/skill\",enabled=false}]");
    expect(args.at(-1)).toBe("-");
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    const external = codexArgs({ binary: "codex", model: "example-model", effort: "medium",
      workspace: "/tmp/work", finalMessage: "/tmp/final.md", disabledSkills: [], externalSandbox: true });
    expect(external[external.indexOf("--sandbox") + 1]).toBe("danger-full-access");
  });

  test("failed runs stay in the denominator and design review stays pending", () => {
    const results: RunResult[] = [{ id: "01-baseline", variant: "baseline", repetition: 1,
      status: "failed", stages: {}, integrity: null, designReview: "pending" }];
    expect(report(results, false, 19)).toContain("| baseline | 0/1 | 0/19 |");
    expect(report(results, true, 19)).toContain("not measured");
    expect(report(results, false, 19)).toContain("Human design review is pending");
  });
});

describe("failure accounting", () => {
  test("reads completion and usage, but rejects failed and malformed streams", () => {
    expect(parseEvents([
      { type: "item.completed", item: { type: "command_execution" } },
      { type: "turn.completed", usage: { input_tokens: 42, output_tokens: 7 } },
    ].map(event => JSON.stringify(event)).join("\n"))).toMatchObject({
      completed: true, failed: false, toolCalls: 1, usage: { input_tokens: 42, output_tokens: 7 },
    });
    expect(parseEvents('{"type":"turn.failed"}\ninvalid')).toMatchObject({
      completed: false, failed: true, malformedLines: 1,
    });
    expect(parseEvents("").usage).toBeNull();
  });

  test("missing, truncated, and incomplete test reports cannot pass", () => {
    expect(parseJunit("", 19)).toBeNull();
    expect(parseJunit('<testsuites tests="0" failures="0" errors="0">', 19)).toBeNull();
    expect(parseJunit('<testsuites tests="19" failures="2" errors="1" skipped="3"></testsuites>', 19))
      .toEqual({ tests: 19, passed: 13, failures: 2, errors: 1, skipped: 3 });
    expect(parseJunit('<testsuites tests="19" failures="20" errors="0">', 19)).toBeNull();
    expect(parseJunit('<testsuites tests="19" failures="0"></testsuites>', 19)?.passed).toBe(19);
  });

  test("missing executables and nonzero exits are retained", async () => {
    const missing = await command(["/no/such/kamae-executable"], temporary, join(temporary, "missing"), 1000);
    expect(succeeded(missing)).toBe(false); expect(missing.error).toBeDefined();
    const failed = await command(["bun", "-e", 'console.error("failure evidence");process.exit(7)'],
      temporary, join(temporary, "failure"), 1000);
    expect(failed.exitCode).toBe(7);
    expect(await read(join(temporary, "failure.stderr"))).toContain("failure evidence");
  });

  test("timeouts stop the process and retain partial output", async () => {
    const result = await command(["bun", "-e", 'console.log("started");setInterval(()=>{},1000)'],
      temporary, join(temporary, "timeout"), 150);
    expect(result.timedOut).toBe(true); expect(succeeded(result)).toBe(false);
    expect(await read(join(temporary, "timeout.stdout"))).toContain("started");
  });
});

describe("artifact and skill isolation", () => {
  test("full pipeline rejects changed inputs and still grades the other condition", async () => {
    const fake = join(temporary, "fake-codex");
    const reference = await read(join(import.meta.dir, "fixtures/reference.ts.txt"));
    await writeFile(fake, `#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
if (process.argv.includes('--version')) { console.log('fake-codex test control'); process.exit(0); }
const cwd = process.argv[process.argv.indexOf('--cd') + 1];
const input = await Bun.stdin.text();
const audit = process.argv.find(arg => arg.startsWith('model_providers.context_audit='));
if (audit) {
  const base = audit.match(/base_url="([^"]+)"/)[1];
  await fetch(base + '/responses', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    model:'fake-model',instructions:'Fake CLI defaults',tools:[],input:[
      {role:'user',content:[{type:'input_text',text:'<environment_context>test</environment_context>'}]},
      {role:'user',content:[{type:'input_text',text:input}]}
    ]})});
  process.exit(1);
}
if (existsSync(join(cwd, 'acceptance'))) throw new Error('Leaked acceptance tests');
if (input.includes('First produce DESIGN.md;')) {
  writeFileSync(join(cwd, 'DESIGN.md'), '# Frozen test proposal');
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  pkg.dependencies = {zod:'4.1.5'};
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg));
} else {
  writeFileSync(join(cwd, 'src/index.ts'), ${JSON.stringify(reference)});
  writeFileSync(join(cwd, 'src/smoke.test.ts'), 'import {test,expect} from "bun:test"; import {createExpenseService} from "./index"; test("export",()=>expect(typeof createExpenseService).toBe("function"));');
  writeFileSync(join(cwd, 'IMPLEMENTATION.md'), 'Test control implementation');
  if (!existsSync(join(cwd, '.agents/skills/kamae/SKILL.md'))) {
    writeFileSync(join(cwd, 'DESIGN.md'), 'Rewritten proposal');
  }
}
console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}}));
`);
    await chmod(fake, 0o755);
    const output = join(temporary, "pipeline");
    const execution = await command(["bun", "run", "benchmarks/runner/run.ts", "--model", "fake-model",
      "--runs", "1", "--codex-bin", fake, "--output", output], resolve(import.meta.dir, "../.."),
      join(temporary, "pipeline-run"), 60000);
    expect(execution.exitCode).toBe(1);
    const runs = JSON.parse(await read(join(output, "results.json")));
    expect(runs[0]).toMatchObject({ status: "failed", integrity: false });
    expect(runs[1]).toMatchObject({ status: "completed", integrity: true,
      acceptance: { counts: { passed: 19, tests: 19 } } });
    expect(await read(join(output, "01-baseline/DESIGN.md"))).toBe("# Frozen test proposal");
    expect(await read(join(output, "report.md"))).toContain("| baseline | 0/1 | 0/19 |");
    expect(await read(join(output, "report.md"))).toContain("| kamae | 1/1 | 19/19 |");
    const originalResults = await read(join(output, "results.json"));
    const originalWorkspace = await hashes(join(output, "01-kamae/workspace"));
    const graded = await regrade(output, resolve(import.meta.dir, "../cases/expense-approval/acceptance"), join(temporary, "regraded"));
    expect(graded[0]?.status).toBe("failed");
    expect(graded[1]?.acceptance?.counts?.passed).toBe(19);
    expect(await read(join(output, "results.json"))).toBe(originalResults);
    expect(await hashes(join(output, "01-kamae/workspace"))).toEqual(originalWorkspace);
  }, 90000);

  test("follows skill directory aliases without looping or touching user files", async () => {
    const root = join(temporary, "skills"); await mkdir(join(root, "kamae"), { recursive: true });
    await writeFile(join(root, "kamae/SKILL.md"), "original");
    await symlink(root, join(root, "cycle"));
    await symlink(join(root, "kamae"), join(root, "alias"));
    await symlink(join(root, "kamae/SKILL.md"), join(root, "file-link"));
    const disabled = await skillOverrides([root, join(temporary, "absent")]);
    expect(disabled).toContain(join(root, "kamae"));
    expect(disabled).toContain(join(root, "alias"));
    expect(await read(join(root, "kamae/SKILL.md"))).toBe("original");
    expect(await files(root).catch(() => "rejected")).toBe("rejected");
  });

  test("dry run preserves identical inputs and a treatment-only skill snapshot", async () => {
    const output = join(temporary, "dry-run");
    const result = await command(["bun", "run", "benchmarks/runner/run.ts", "--dry-run", "--runs", "1",
      "--codex-bin", "/no/model/needed", "--output", output], resolve(import.meta.dir, "../.."),
      join(temporary, "dry"), 10000);
    expect(succeeded(result)).toBe(true);
    const baseline = await hashes(join(output, "01-baseline/workspace"));
    expect(Object.keys(baseline).sort()).toEqual(["API.md", "PRD.md", "bun.lock", "package.json", "tsconfig.json"]);
    expect(JSON.parse(await read(join(output, "01-baseline/workspace/package.json"))).dependencies).toEqual({});
    const treatment = await hashes(join(output, "01-kamae/workspace"));
    expect(Object.fromEntries(Object.entries(treatment).filter(([path]) => !path.startsWith(".agents/"))))
      .toEqual(baseline);
    expect(treatment[".agents/skills/kamae/SKILL.md"]).toBeDefined();
    expect(Object.keys(baseline).some(path => path.includes("acceptance"))).toBe(false);
    expect(JSON.parse(await readFile(join(output, "results.json"), "utf8")))
      .toMatchObject([{ status: "planned" }, { status: "planned" }]);
    const repeated = await command(["bun", "run", "benchmarks/runner/run.ts", "--dry-run", "--output", output],
      resolve(import.meta.dir, "../.."), join(temporary, "repeat"), 10000);
    expect(succeeded(repeated)).toBe(false);
    expect(await read(join(temporary, "repeat.stderr"))).toContain("EEXIST");
  });
});
