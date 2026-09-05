import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";

let cancellation: NodeJS.Signals | undefined;
export const interrupted = () => cancellation !== undefined;

export type CommandResult = {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  error?: string;
};

// Files, rather than output pipes, bound memory and preserve partial output on failure.
export async function command(
  args: string[], cwd: string, log: string, timeoutMs: number,
  input?: string, env: NodeJS.ProcessEnv = process.env,
): Promise<CommandResult> {
  const started = Date.now();
  if (cancellation) return { exitCode: null, timedOut: false, durationMs: 0, error: `Interrupted by ${cancellation}` };
  const stdout = openSync(`${log}.stdout`, "w");
  const stderr = openSync(`${log}.stderr`, "w");
  try {
    return await new Promise((resolve) => {
      const child = spawn(args[0]!, args.slice(1), {
        cwd, env, stdio: ["pipe", stdout, stderr], detached: process.platform !== "win32",
      });
      let timedOut = false;
      const kill = (signal: NodeJS.Signals) => {
        try {
          if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill(signal);
        }
      };
      const timer = setTimeout(() => {
        timedOut = true; kill("SIGKILL");
      }, timeoutMs);
      const interrupt = (signal: NodeJS.Signals) => { cancellation = signal; kill("SIGKILL"); };
      process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
      const cleanup = () => {
        clearTimeout(timer);
        process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
      };
      child.once("error", (error) => {
        cleanup(); resolve({ exitCode: null, timedOut, durationMs: Date.now() - started, error: error.message });
      });
      child.once("close", (exitCode) => {
        cleanup(); resolve({ exitCode, timedOut, durationMs: Date.now() - started,
          ...(cancellation ? { error: `Interrupted by ${cancellation}` } : {}) });
      });
      child.stdin?.on("error", () => {}); // A failed executable can close stdin before the prompt is sent.
      child.stdin?.end(input);
    });
  } finally { closeSync(stdout); closeSync(stderr); }
}

export function succeeded(result: CommandResult): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.error;
}

export function parseEvents(jsonl: string) {
  let completed = false, failed = false, toolCalls = 0, malformedLines = 0;
  let usage: Record<string, number> | null = null;
  for (const line of jsonl.split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.completed") {
        completed = true;
        if (typeof event.usage?.input_tokens === "number" && typeof event.usage?.output_tokens === "number") {
          usage = Object.fromEntries(Object.entries(event.usage).filter((entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isFinite(entry[1])));
        }
      }
      if (event.type === "turn.failed" || event.type === "error") failed = true;
      if (event.type === "item.completed" &&
          ["command_execution", "mcp_tool_call", "web_search", "file_change"].includes(event.item?.type)) toolCalls++;
    } catch { malformedLines++; }
  }
  return { completed, failed, toolCalls, usage, malformedLines };
}

export function parseJunit(xml: string, expectedTests: number) {
  if (!xml.includes("</testsuites>")) return null;
  const root = xml.match(/<testsuites\b([^>]*)>/)?.[1];
  const count = (name: string) => {
    const value = root?.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1];
    return value === undefined ? null : Number(value);
  };
  // Bun omits the errors attribute when there are no suite-level errors.
  const tests = count("tests"), failures = count("failures"), errors = count("errors") ?? 0;
  const skipped = count("skipped") ?? 0;
  if (tests === null || failures === null || tests !== expectedTests ||
      failures + errors + skipped > tests) return null;
  return { tests, passed: tests - failures - errors - skipped, failures, errors, skipped };
}
