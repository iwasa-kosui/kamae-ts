import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyTree, read } from "./files";
import { command, parseJunit, succeeded } from "./process";

const temporary = await mkdtemp(join(tmpdir(), "kamae-acceptance-control-"));
afterAll(() => rm(temporary, { recursive: true, force: true }));

test("acceptance passes a behavioral control and detects a validation regression", async () => {
  const caseRoot = resolve(import.meta.dir, "../cases/expense-approval");
  const workspace = join(temporary, "project");
  await copyTree(join(caseRoot, "starter"), workspace);
  const install = await command(["bun", "install", "--frozen-lockfile", "--ignore-scripts"], workspace,
    join(temporary, "install"), 60000);
  expect(succeeded(install)).toBe(true);
  const control = await read(join(import.meta.dir, "fixtures/reference.ts.txt"));
  await writeFile(join(workspace, "src/index.ts"), control);
  await copyTree(join(caseRoot, "acceptance"), join(workspace, "acceptance"));
  const typecheck = await command(["bun", "run", "typecheck"], workspace, join(temporary, "typecheck"), 30000);
  expect(succeeded(typecheck)).toBe(true);
  const grade = async (name: string) => {
    const xml = join(temporary, `${name}.xml`);
    const execution = await command(["bun", "test", "./acceptance", "--reporter=junit", `--reporter-outfile=${xml}`],
      workspace, join(temporary, name), 30000);
    return { execution, counts: parseJunit(await read(xml), 19) };
  };
  const good = await grade("control");
  expect(good.counts).toMatchObject({ tests: 19, passed: 19, failures: 0 });
  expect(succeeded(good.execution)).toBe(true);
  await writeFile(join(workspace, "src/index.ts"), control.replace(".min(1).max(1000000)", ".max(1000000)"));
  const broken = await grade("mutant");
  expect(succeeded(broken.execution)).toBe(false);
  expect(broken.counts?.failures).toBeGreaterThan(0);
  expect(broken.counts?.passed).toBeLessThan(19);
}, 90000);
