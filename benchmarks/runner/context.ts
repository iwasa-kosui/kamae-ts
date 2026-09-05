import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { realpath, writeFile } from "node:fs/promises";
import { json } from "./files";
import { command } from "./process";

export type Isolation = "audit" | "macos";

// Authentication is untouched. Deny personal instruction sources to the CLI and
// all of its children, including tools. Writes are restricted too; this is not a container.
export async function isolationPrefix(mode: Isolation, artifact: string, workspace: string, hiddenRoots: string[] = []): Promise<string[]> {
  if (mode === "audit") return [];
  if (process.platform !== "darwin") throw new Error("macos isolation requires macOS sandbox-exec");
  const codexRoot = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const denied = new Set([
    join(homedir(), ".agents"), join(homedir(), ".claude"),
    ...["AGENTS.md", "AGENTS.override.md", "config.toml", "rules", "skills", "plugins", "memories"].map(p => join(codexRoot, p)),
    "/etc/codex", join(tmpdir(), ".agents"),
  ]);
  for (let parent = dirname(resolve(workspace)); ; parent = dirname(parent)) {
    for (const path of ["AGENTS.md", "AGENTS.override.md", ".agents", ".claude"])
      denied.add(join(parent, path));
    if (parent === dirname(parent)) break;
  }
  for (const path of [...denied]) {
    try { denied.add(await realpath(path)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const writable = [workspace, artifact, codexRoot];
  const profile = `(version 1)\n(allow default)\n(deny file-write* (require-all\n${writable.map(path =>
    ` (require-not (subpath ${JSON.stringify(resolve(path))}))`).join("\n")}\n (require-not (literal "/dev/null"))))\n${[...denied].sort().map(path =>
    `(deny file-read* file-write* (subpath ${JSON.stringify(path)}))`).join("\n")}\n${hiddenRoots.map(path =>
    `(deny file-read-data (subpath ${JSON.stringify(resolve(path))}))`).join("\n")}\n`;
  const path = join(artifact, "context.sb");
  await writeFile(path, profile);
  return ["/usr/bin/sandbox-exec", "-f", path];
}

export async function verifySandbox(prefix: string[], workspace: string, artifact: string, outside: string) {
  if (!prefix.length) return;
  const source = `import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const own=${JSON.stringify(join(workspace, '.sandbox-probe'))};
writeFileSync(own,'probe'); if(readFileSync(own,'utf8')!=='probe') throw Error('Workspace read failed'); unlinkSync(own);
let blocked=false;try{readFileSync(${JSON.stringify(join(homedir(), '.codex/AGENTS.md'))});}catch(e){blocked=e.code==='EPERM'||e.code==='EACCES'||e.code==='ENOENT';}
if(!blocked) throw Error('Personal instructions are readable');
try{writeFileSync(${JSON.stringify(outside)},'probe');throw Error('Outside write allowed');}catch(e){if(e.code!=='EPERM'&&e.code!=='EACCES')throw e;}
console.log('Workspace read/write works; personal instructions and outside writes denied');`;
  const result = await command([...prefix, "bun", "-e", source], workspace, join(artifact, "sandbox-probe"), 10000);
  if (result.exitCode !== 0 || result.error || result.timedOut) throw new Error("OS sandbox probe failed; no model invoked");
}

type InputMessage = { role?: string; content?: { type?: string; text?: string }[] };
export type CapturedInput = { instructions?: string; input?: InputMessage[]; tools?: unknown[]; model?: string };

// Fail closed on added user-context messages, even when their text does not name
// a known skill. System/tool definitions remain the installed CLI's defaults.
export function inspectContext(request: CapturedInput, prompt: string) {
  if (!Array.isArray(request.input) || typeof request.instructions !== "string")
    throw new Error("Unrecognized initial request format");
  let taskCount = 0, environmentCount = 0;
  for (const message of request.input) {
    if (!Array.isArray(message.content) || message.content.some(c => c.type !== "input_text" || typeof c.text !== "string"))
      throw new Error("Unexpected initial content block");
    const text = message.content.map(c => c.text).join("\n").trim();
    if (message.role === "user" && text === prompt.trim()) { taskCount++; continue; }
    if (message.role === "user" && /^<environment_context>[\s\S]*<\/environment_context>$/.test(text) &&
        !/#.*AGENTS|## Skills|<memory|MEMORY\.md/i.test(text)) { environmentCount++; continue; }
    if (message.role === "developer" && /^<permissions instructions>[\s\S]*<\/permissions instructions>$/.test(text)) continue;
    throw new Error(`Unexpected ${message.role ?? "unknown"} context; inspect captured input before running a model`);
  }
  if (taskCount !== 1 || environmentCount !== 1) throw new Error("Missing or duplicate task/environment input");
  return { passed: true, inputMessages: request.input.length, model: request.model,
    instructionsSha256: createHash("sha256").update(request.instructions).digest("hex"),
    toolsSha256: createHash("sha256").update(JSON.stringify(request.tools)).digest("hex") };
}

// Recreate the initial exec request with the same flags/workspace and a loopback
// transport that returns 400. Never save headers or forward credentials/requests.
// This preflight is evidence of CLI context construction, not the remote request.
export async function auditContext(args: string[], prefix: string[], workspace: string, artifact: string, prompt: string) {
  let captured: CapturedInput | undefined;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    if (request.method !== "POST") return new Response("Local context audit", { status: 404 });
    captured = await request.json() as CapturedInput;
    return Response.json({ error: { message: "Context captured; no model invoked", type: "invalid_request_error" } }, { status: 400 });
  } });
  try {
    const auditArgs = [...args];
    auditArgs.splice(auditArgs.length - 1, 0, "-c", 'model_provider="context_audit"', "-c",
      `model_providers.context_audit={name="Context audit",base_url="http://127.0.0.1:${server.port}/v1",wire_api="responses",requires_openai_auth=false,supports_websockets=false,request_max_retries=0,stream_max_retries=0}`);
    const execution = await command([...prefix, ...auditArgs], workspace, `${artifact}.capture`, 30000, prompt);
    if (!captured || execution.timedOut) throw new Error("Initial context capture failed; inspect capture.stderr");
    await json(`${artifact}.input.json`, captured);
    const inspection = inspectContext(captured, prompt);
    await json(`${artifact}.audit.json`, { ...inspection,
      method: "Loopback preflight; same exec flags and files, different provider transport. No model call.",
      limitation: "Not a copy of the remote request; provider-specific model metadata may differ." });
    return inspection;
  } finally { server.stop(true); }
}
