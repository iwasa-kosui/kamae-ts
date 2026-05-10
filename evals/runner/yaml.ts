import { Glob } from 'bun'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { EvalSuite, TaskFile } from './types.ts'

export async function loadSuite(suitePath: string): Promise<{
  suite: EvalSuite
  suiteDir: string
  fixturesDir: string
}> {
  const absPath = resolve(suitePath)
  const raw = await readFile(absPath, 'utf8')
  const suite = parseYaml(raw) as EvalSuite
  const suiteDir = dirname(absPath)
  return { suite, suiteDir, fixturesDir: join(suiteDir, 'fixtures') }
}

export async function loadTasks(
  suite: EvalSuite,
  suiteDir: string,
): Promise<readonly { file: string; task: TaskFile }[]> {
  const matched = new Set<string>()
  for (const pattern of suite.tasks) {
    const glob = new Glob(pattern)
    for await (const rel of glob.scan({ cwd: suiteDir })) {
      matched.add(join(suiteDir, rel))
    }
  }
  const sorted = [...matched].sort()
  const out: { file: string; task: TaskFile }[] = []
  for (const file of sorted) {
    const raw = await readFile(file, 'utf8')
    const task = parseYaml(raw) as TaskFile
    out.push({ file, task })
  }
  return out
}
