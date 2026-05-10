import { compilePattern } from './regex.ts'
import type { GraderResult, GraderSpec, TaskTrial } from './types.ts'

export type GraderInput = {
  responseText: string
  toolUses: readonly { name: string; index: number }[]
}

export function aggregateInput(trial: TaskTrial): GraderInput {
  return { responseText: trial.responseText, toolUses: trial.toolUses }
}

export function runGrader(spec: GraderSpec, input: GraderInput): GraderResult {
  switch (spec.type) {
    case 'text':
      return runTextGrader(spec.name, spec.config, input.responseText)
    case 'behavior':
      return runBehaviorGrader(spec.name, spec.config, input.toolUses)
  }
}

function runTextGrader(
  name: string,
  config: {
    regex_match?: readonly string[]
    regex_not_match?: readonly string[]
    contains?: readonly string[]
    not_contains?: readonly string[]
  },
  text: string,
): GraderResult {
  const failures: string[] = []

  for (const pattern of config.regex_match ?? []) {
    const re = compilePattern(pattern)
    if (!re.test(text)) failures.push(`regex_match miss: /${pattern}/`)
  }
  for (const pattern of config.regex_not_match ?? []) {
    const re = compilePattern(pattern)
    if (re.test(text)) failures.push(`regex_not_match hit: /${pattern}/`)
  }
  for (const needle of config.contains ?? []) {
    if (!text.includes(needle)) failures.push(`contains miss: "${needle}"`)
  }
  for (const needle of config.not_contains ?? []) {
    if (text.includes(needle)) failures.push(`not_contains hit: "${needle}"`)
  }

  const passed = failures.length === 0
  return {
    graderName: name,
    graderType: 'text',
    score: passed ? 1 : 0,
    passed,
    detail: passed ? 'All text checks passed' : failures.join('; '),
  }
}

function runBehaviorGrader(
  name: string,
  config: { max_tool_calls?: number; min_tool_calls?: number; required_tools?: readonly string[] },
  toolUses: readonly { name: string }[],
): GraderResult {
  const failures: string[] = []
  const count = toolUses.length

  if (config.max_tool_calls !== undefined && count > config.max_tool_calls) {
    failures.push(`tool_calls=${count} exceeds max=${config.max_tool_calls}`)
  }
  if (config.min_tool_calls !== undefined && count < config.min_tool_calls) {
    failures.push(`tool_calls=${count} below min=${config.min_tool_calls}`)
  }
  if (config.required_tools !== undefined && config.required_tools.length > 0) {
    const seen = new Set(toolUses.map((u) => u.name))
    const missing = config.required_tools.filter((t) => !seen.has(t))
    if (missing.length > 0) failures.push(`missing required tools: ${missing.join(', ')}`)
  }

  const passed = failures.length === 0
  return {
    graderName: name,
    graderType: 'behavior',
    score: passed ? 1 : 0,
    passed,
    detail: passed ? 'All behavior checks passed' : failures.join('; '),
  }
}
