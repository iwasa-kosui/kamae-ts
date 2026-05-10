import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { TaskFile, TaskTrial } from './types.ts'

export type RunClaudeOptions = {
  prompt: string
  pluginDir: string
  fixturesDir: string
  model?: string
  timeoutSeconds: number
  trial: number
}

type StreamEvent = Record<string, unknown>

// `--tools` constrains the available built-in tool set (unlike `--allowedTools`,
// which only governs auto-approval). Bash is excluded — the agent can write
// files via `cat > path`, which inflates tool counts and makes lazy-loading
// graders moot. The eval expects code answers in the response, not scaffolded
// projects in a tmpdir. CLI accepts comma-separated string per claude --help.
const TOOL_SET = 'Read,Glob,Grep,Skill'

export async function runClaudeForTask(
  task: TaskFile,
  options: RunClaudeOptions,
): Promise<TaskTrial> {
  const sandbox = await createSandbox(task, options.fixturesDir)
  try {
    const prompt = buildPrompt(task, options.prompt)
    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--print',
      '--add-dir',
      sandbox,
      '--plugin-dir',
      options.pluginDir,
      '--tools',
      TOOL_SET,
      '--permission-mode',
      'bypassPermissions',
      '--no-session-persistence',
    ]
    if (options.model !== undefined) args.push('--model', options.model)

    const start = Date.now()
    const events = await invokeClaude(args, sandbox, options.timeoutSeconds)
    const durationMs = Date.now() - start

    return parseTrial(events, options.trial, durationMs)
  } finally {
    await rm(sandbox, { recursive: true, force: true })
  }
}

async function createSandbox(task: TaskFile, fixturesDir: string): Promise<string> {
  const sandbox = await mkdtemp(join(tmpdir(), `kamae-eval-${task.id}-`))
  for (const fileSpec of task.inputs.files ?? []) {
    const src = resolve(fixturesDir, fileSpec.path)
    const dst = join(sandbox, fileSpec.path)
    await mkdir(dirname(dst), { recursive: true })
    await copyFile(src, dst)
  }
  return sandbox
}

function buildPrompt(task: TaskFile, prompt: string): string {
  const files = task.inputs.files ?? []
  if (files.length === 0) return prompt
  const list = files.map((f) => `- ${f.path}`).join('\n')
  return `${prompt}\n\nThe following files are available in the working directory:\n${list}\nRead them as needed.`
}

function invokeClaude(args: readonly string[], cwd: string, timeoutSeconds: number): Promise<StreamEvent[]> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    const events: StreamEvent[] = []
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutSeconds * 1000)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      let newlineIdx = stdoutBuffer.indexOf('\n')
      while (newlineIdx >= 0) {
        const line = stdoutBuffer.slice(0, newlineIdx).trim()
        stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1)
        if (line.length > 0) {
          try {
            events.push(JSON.parse(line) as StreamEvent)
          } catch {
            // ignore malformed lines (rare; partial-message chunks already merge upstream)
          }
        }
        newlineIdx = stdoutBuffer.indexOf('\n')
      }
    })
    child.stderr.on('data', (chunk: string) => {
      stderrBuffer += chunk
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      rejectPromise(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        rejectPromise(new Error(`claude timed out after ${timeoutSeconds}s`))
        return
      }
      if (code !== 0) {
        rejectPromise(new Error(`claude exited with code ${code}: ${stderrBuffer.slice(-500)}`))
        return
      }
      resolvePromise(events)
    })
  })
}

function parseTrial(events: readonly StreamEvent[], trial: number, durationMs: number): TaskTrial {
  let responseText = ''
  let isError = false
  let costUsd = 0
  const toolUses: { name: string; index: number }[] = []

  let toolIndex = 0
  for (const event of events) {
    const type = event['type']
    if (type === 'assistant') {
      const message = event['message'] as { content?: unknown[] } | undefined
      const content = message?.content ?? []
      for (const block of content) {
        if (typeof block !== 'object' || block === null) continue
        const blockType = (block as { type?: unknown }).type
        if (blockType === 'tool_use') {
          const name = (block as { name?: unknown }).name
          if (typeof name === 'string') {
            toolUses.push({ name, index: toolIndex })
            toolIndex += 1
          }
        }
      }
    } else if (type === 'result') {
      const result = (event as { result?: unknown }).result
      if (typeof result === 'string') responseText = result
      const errFlag = (event as { is_error?: unknown }).is_error
      if (errFlag === true) isError = true
      const cost = (event as { total_cost_usd?: unknown }).total_cost_usd
      if (typeof cost === 'number') costUsd = cost
    }
  }

  return {
    trial,
    isError,
    responseText,
    toolUseCount: toolUses.length,
    toolUses,
    durationMs,
    costUsd,
  }
}
