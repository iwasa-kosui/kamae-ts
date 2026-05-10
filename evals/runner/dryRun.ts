import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { compilePattern } from './regex.ts'
import { loadSuite, loadTasks } from './yaml.ts'
import type { GraderSpec } from './types.ts'

export type DryRunResult = {
  suitePath: string
  passed: boolean
  checks: readonly { name: string; passed: boolean; detail: string }[]
}

const TEXT_KEYS = new Set(['regex_match', 'regex_not_match', 'contains', 'not_contains'])
const BEHAVIOR_KEYS = new Set(['max_tool_calls', 'min_tool_calls', 'required_tools'])

export async function dryRunSuite(suitePath: string, repoRoot: string): Promise<DryRunResult> {
  const checks: { name: string; passed: boolean; detail: string }[] = []
  const record = (name: string, passed: boolean, detail: string): void => {
    checks.push({ name, passed, detail })
  }

  const { suite, suiteDir, fixturesDir } = await loadSuite(suitePath)

  record('suite_yaml_parsed', true, `name=${suite.name} skill=${suite.skill}`)

  if (!existsSync(fixturesDir) || !statSync(fixturesDir).isDirectory()) {
    record('fixtures_dir_exists', false, fixturesDir)
  } else {
    record('fixtures_dir_exists', true, fixturesDir)
  }

  for (const grader of suite.graders) validateGrader(grader, record)

  const tasks = await loadTasks(suite, suiteDir)
  if (tasks.length === 0) {
    record('tasks_globbed', false, 'no tasks matched')
  } else {
    record('tasks_globbed', true, `${tasks.length} task(s) found`)
  }

  for (const { file, task } of tasks) {
    const rel = relative(suiteDir, file)
    if (typeof task.id !== 'string' || task.id.length === 0) {
      record(`task[${rel}].id`, false, 'missing or empty')
      continue
    }
    if (typeof task.inputs?.prompt !== 'string' || task.inputs.prompt.length === 0) {
      record(`task[${task.id}].prompt`, false, 'missing or empty')
    }
    for (const fileSpec of task.inputs?.files ?? []) {
      const abs = resolve(fixturesDir, fileSpec.path)
      if (!existsSync(abs)) {
        record(`task[${task.id}].file[${fileSpec.path}]`, false, `not found under ${fixturesDir}`)
      }
    }
    for (const grader of task.graders ?? []) validateGrader(grader, record, `task[${task.id}].`)
  }

  await validateSkillFrontmatter(repoRoot, suite.skill, record)

  const passed = checks.every((c) => c.passed)
  return { suitePath, passed, checks }
}

function validateGrader(
  grader: GraderSpec,
  record: (name: string, passed: boolean, detail: string) => void,
  prefix = '',
): void {
  const tag = `${prefix}grader[${grader.name}]`
  if (grader.type === 'text') {
    const config = (grader as { config?: Record<string, unknown> }).config ?? {}
    const unknown = Object.keys(config).filter((k) => !TEXT_KEYS.has(k))
    if (unknown.length > 0) {
      record(tag, false, `unknown text grader keys: ${unknown.join(', ')}`)
      return
    }
    for (const k of ['regex_match', 'regex_not_match'] as const) {
      const v = config[k]
      if (Array.isArray(v)) {
        for (const pattern of v as readonly unknown[]) {
          if (typeof pattern !== 'string') {
            record(tag, false, `${k} contains non-string`)
            return
          }
          try {
            compilePattern(pattern)
          } catch (err) {
            record(tag, false, `${k} invalid pattern /${pattern}/: ${(err as Error).message}`)
            return
          }
        }
      }
    }
    record(tag, true, 'text grader config valid')
    return
  }
  if (grader.type === 'behavior') {
    const config = (grader as { config?: Record<string, unknown> }).config ?? {}
    const unknown = Object.keys(config).filter((k) => !BEHAVIOR_KEYS.has(k))
    if (unknown.length > 0) {
      record(tag, false, `unknown behavior grader keys: ${unknown.join(', ')}`)
      return
    }
    record(tag, true, 'behavior grader config valid')
    return
  }
  const t = (grader as { type?: unknown }).type
  record(tag, false, `unsupported grader type: ${String(t)}`)
}

async function validateSkillFrontmatter(
  repoRoot: string,
  skill: string,
  record: (name: string, passed: boolean, detail: string) => void,
): Promise<void> {
  const skillFile = join(repoRoot, 'skills', skill, 'SKILL.md')
  if (!existsSync(skillFile)) {
    record(`skill[${skill}].SKILL.md`, false, `not found at ${skillFile}`)
    return
  }
  const content = await readFile(skillFile, 'utf8')
  const match = content.match(/^---\n([\s\S]*?)\n---/u)
  if (match === null) {
    record(`skill[${skill}].frontmatter`, false, 'no YAML frontmatter found')
    return
  }
  try {
    const fm = parseYaml(match[1] ?? '') as { name?: unknown; description?: unknown }
    if (typeof fm.name !== 'string' || typeof fm.description !== 'string') {
      record(`skill[${skill}].frontmatter`, false, 'name or description missing')
      return
    }
    if (fm.name !== skill) {
      record(`skill[${skill}].frontmatter`, false, `name mismatch: yaml=${fm.name} suite=${skill}`)
      return
    }
    record(`skill[${skill}].frontmatter`, true, `name=${fm.name}`)
  } catch (err) {
    record(`skill[${skill}].frontmatter`, false, `parse error: ${(err as Error).message}`)
  }
}
