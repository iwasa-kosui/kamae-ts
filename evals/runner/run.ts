#!/usr/bin/env bun
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runClaudeForTask } from './claude.ts'
import { dryRunSuite } from './dryRun.ts'
import { aggregateInput, runGrader } from './graders.ts'
import type {
  GraderResult,
  GraderSpec,
  SuiteResult,
  TaskFile,
  TaskResult,
  TaskTrial,
} from './types.ts'
import { loadSuite, loadTasks } from './yaml.ts'

type CliArgs = {
  suitePath: string
  outputPath?: string
  dryRun: boolean
  model?: string
  repoRoot: string
}

function parseArgs(argv: readonly string[]): CliArgs {
  let suitePath: string | undefined
  let outputPath: string | undefined
  let dryRun = false
  let model: string | undefined
  let repoRoot: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--output' || arg === '-o') outputPath = argv[++i]
    else if (arg === '--model') model = argv[++i]
    else if (arg === '--repo-root') repoRoot = argv[++i]
    else if (arg !== undefined && !arg.startsWith('-')) suitePath = arg
    else throw new Error(`unknown argument: ${arg}`)
  }

  if (suitePath === undefined) {
    throw new Error('usage: run.ts <eval.yaml> [--dry-run] [--output results.json] [--model name]')
  }
  return {
    suitePath: resolve(suitePath),
    ...(outputPath !== undefined ? { outputPath: resolve(outputPath) } : {}),
    dryRun,
    ...(model !== undefined ? { model } : {}),
    repoRoot: resolve(repoRoot ?? process.cwd()),
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.dryRun) {
    const result = await dryRunSuite(args.suitePath, args.repoRoot)
    printDryRun(result)
    if (args.outputPath !== undefined) {
      await writeFile(args.outputPath, JSON.stringify(result, null, 2), 'utf8')
    }
    process.exit(result.passed ? 0 : 1)
  }

  const suiteResult = await runSuite(args)
  printSuite(suiteResult)
  if (args.outputPath !== undefined) {
    await writeFile(args.outputPath, JSON.stringify(suiteResult, null, 2), 'utf8')
    console.log(`\nResults saved to: ${args.outputPath}`)
  }
  process.exit(suiteResult.failed > 0 || suiteResult.errors > 0 ? 1 : 0)
}

async function runSuite(args: CliArgs): Promise<SuiteResult> {
  const { suite, suiteDir, fixturesDir } = await loadSuite(args.suitePath)
  const tasks = await loadTasks(suite, suiteDir)
  const trialsPerTask = suite.config?.trials_per_task ?? 1
  const timeoutSeconds = suite.config?.timeout_seconds ?? 300

  const taskResults: TaskResult[] = []
  const overallStart = Date.now()

  console.log(`Running ${tasks.length} task(s) from ${suite.name}\n`)

  for (let i = 0; i < tasks.length; i++) {
    const entry = tasks[i]
    if (entry === undefined) continue
    const { task } = entry
    console.log(`[${i + 1}/${tasks.length}] ${task.name}`)
    const taskStart = Date.now()
    const trials: TaskTrial[] = []
    for (let trial = 1; trial <= trialsPerTask; trial++) {
      const trialResult = await runClaudeForTask(task, {
        prompt: task.inputs.prompt,
        pluginDir: args.repoRoot,
        fixturesDir,
        timeoutSeconds,
        trial,
        ...(args.model !== undefined ? { model: args.model } : {}),
      })
      trials.push(trialResult)
      console.log(
        `  trial ${trial}: tools=${trialResult.toolUseCount} duration=${trialResult.durationMs}ms cost=$${trialResult.costUsd.toFixed(4)}`,
      )
    }
    const taskResult = aggregateTaskResult(task, trials, suite.graders, taskStart)
    taskResults.push(taskResult)
    for (const g of taskResult.graderResults) {
      const mark = g.passed ? '✓' : '✗'
      console.log(`    ${mark} ${g.graderName} score=${g.score.toFixed(2)} — ${g.detail}`)
    }
    console.log(`  ${taskResult.passed ? 'PASS' : 'FAIL'} avg=${taskResult.averageScore.toFixed(2)}\n`)
  }

  const succeeded = taskResults.filter((t) => t.passed).length
  const failed = taskResults.length - succeeded
  const errors = taskResults.filter((t) => t.trials.some((tr) => tr.isError)).length
  const scores = taskResults.map((t) => t.averageScore)
  const aggregateScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  return {
    suiteName: suite.name,
    skill: suite.skill,
    totalTasks: taskResults.length,
    succeeded,
    failed,
    errors,
    aggregateScore,
    minScore: scores.length > 0 ? Math.min(...scores) : 0,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0,
    durationMs: Date.now() - overallStart,
    tasks: taskResults,
  }
}

function aggregateTaskResult(
  task: TaskFile,
  trials: readonly TaskTrial[],
  suiteGraders: readonly GraderSpec[],
  taskStart: number,
): TaskResult {
  const allGraders = [...suiteGraders, ...(task.graders ?? [])]
  const graderResults: GraderResult[] = []
  for (const grader of allGraders) {
    const trialScores = trials.map((trial) => runGrader(grader, aggregateInput(trial)))
    const averaged: GraderResult = {
      graderName: grader.name,
      graderType: grader.type,
      score: avg(trialScores.map((r) => r.score)),
      passed: trialScores.every((r) => r.passed),
      detail: trialScores[0]?.detail ?? '',
    }
    graderResults.push(averaged)
  }
  const taskCompleted = trials.every((t) => !t.isError)
  const allGradersPassed = graderResults.every((g) => g.passed)
  const passed = taskCompleted && allGradersPassed
  const averageScore = passed ? avg(graderResults.map((g) => g.score)) : 0
  return {
    taskId: task.id,
    taskName: task.name,
    trials,
    graderResults,
    averageScore,
    passed,
    durationMs: Date.now() - taskStart,
  }
}

function avg(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function printDryRun(result: { suitePath: string; passed: boolean; checks: readonly { name: string; passed: boolean; detail: string }[] }): void {
  console.log(`Dry-run: ${result.suitePath}`)
  for (const check of result.checks) {
    const mark = check.passed ? '✓' : '✗'
    console.log(`  ${mark} ${check.name}: ${check.detail}`)
  }
  const failed = result.checks.filter((c) => !c.passed).length
  console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed} check(s) failed)`}`)
}

function printSuite(suite: SuiteResult): void {
  console.log('===================================================')
  console.log(' BENCHMARK RESULTS')
  console.log('===================================================')
  console.log(`Suite:          ${suite.suiteName}`)
  console.log(`Total tasks:    ${suite.totalTasks}`)
  console.log(`Succeeded:      ${suite.succeeded}`)
  console.log(`Failed:         ${suite.failed}`)
  console.log(`Errors:         ${suite.errors}`)
  console.log(`Aggregate:      ${suite.aggregateScore.toFixed(2)}`)
  console.log(`Min/Max:        ${suite.minScore.toFixed(2)} / ${suite.maxScore.toFixed(2)}`)
  console.log(`Duration:       ${(suite.durationMs / 1000).toFixed(1)}s`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(2)
})
