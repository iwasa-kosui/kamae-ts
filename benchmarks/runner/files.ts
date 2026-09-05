import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function read(path: string): Promise<string> {
  try { return await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
}

export async function json(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

export async function files(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(dir: string, prefix: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in artifacts: ${relative}`);
      if (entry.isDirectory()) await visit(join(dir, entry.name), relative + "/");
      else if (entry.isFile()) result.push(relative);
    }
  }
  await visit(root, ""); return result.sort();
}

export async function hashes(root: string) {
  const result: Record<string, string> = {};
  for (const path of await files(root)) {
    result[path] = createHash("sha256").update(await readFile(join(root, path))).digest("hex");
  }
  return result;
}

export async function copyTree(source: string, target: string) {
  await mkdir(target, { recursive: true });
  for (const path of await files(source)) {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await cp(join(source, path), join(target, path));
  }
}

// Disable existing skills without moving, rewriting, or copying the user's config/auth.
export async function skillOverrides(roots: string[]): Promise<string[]> {
  const found = new Set<string>();
  async function visit(path: string, ancestors = new Set<string>()) {
    let canonical: string;
    try { canonical = await realpath(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    if (ancestors.has(canonical)) return;
    const visited = new Set(ancestors).add(canonical);
    if (!(await stat(canonical)).isDirectory()) return;
    const entries = await readdir(path, { withFileTypes: true });
    if (entries.some(entry => entry.name === "SKILL.md")) {
      // Current docs use a folder; older CLI builds used the SKILL.md path.
      for (const folder of [resolve(path), canonical]) {
        found.add(folder); found.add(join(folder, "SKILL.md"));
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) await visit(join(path, entry.name), visited);
    }
  }
  for (const root of roots) await visit(root);
  return [...found].sort();
}
