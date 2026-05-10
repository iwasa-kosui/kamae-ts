// YAML schema types for evaluation suites and tasks. Matches the shape that
// `microsoft/waza` originally consumed so existing fixtures are reused as-is.

export type TextGraderConfig = {
  regex_match?: readonly string[]
  regex_not_match?: readonly string[]
  contains?: readonly string[]
  not_contains?: readonly string[]
}

export type BehaviorGraderConfig = {
  max_tool_calls?: number
  min_tool_calls?: number
  required_tools?: readonly string[]
}

export type GraderSpec =
  | { type: 'text'; name: string; config: TextGraderConfig }
  | { type: 'behavior'; name: string; config: BehaviorGraderConfig }

export type EvalConfig = {
  trials_per_task?: number
  timeout_seconds?: number
  parallel?: boolean
}

export type EvalSuite = {
  name: string
  description?: string
  skill: string
  version?: string
  config?: EvalConfig
  graders: readonly GraderSpec[]
  tasks: readonly string[]
}

export type TaskFile = {
  id: string
  name: string
  description?: string
  inputs: {
    prompt: string
    files?: readonly { path: string }[]
  }
  expected?: {
    outcomes?: readonly { type: string }[]
  }
  graders?: readonly GraderSpec[]
}

export type TaskTrial = {
  trial: number
  isError: boolean
  responseText: string
  toolUseCount: number
  toolUses: readonly { name: string; index: number }[]
  durationMs: number
  costUsd: number
}

export type GraderResult = {
  graderName: string
  graderType: 'text' | 'behavior'
  score: number
  passed: boolean
  detail: string
}

export type TaskResult = {
  taskId: string
  taskName: string
  trials: readonly TaskTrial[]
  graderResults: readonly GraderResult[]
  averageScore: number
  passed: boolean
  durationMs: number
}

export type SuiteResult = {
  suiteName: string
  skill: string
  totalTasks: number
  succeeded: number
  failed: number
  errors: number
  aggregateScore: number
  minScore: number
  maxScore: number
  durationMs: number
  tasks: readonly TaskResult[]
}
