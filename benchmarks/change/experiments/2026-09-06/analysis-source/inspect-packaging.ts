import ts from "typescript";
import { existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

// Evidence packaging audit only: flags source hidden by a test filename.
// It does not execute, accept, reject, or score candidate implementations.
const root = import.meta.dir;
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const isExcluded = (path: string) => /(?:^|\/)__tests__\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
const records = [];
for (const task of manifest.tasks) {
  const workspace = join(root, "runs", task.candidate_id, "workspace");
  const status = join(root, "runs", task.candidate_id, "generation.json");
  if (!existsSync(status) || JSON.parse(await readFile(status, "utf8")).status !== "completed") continue;
  const visited = new Set<string>(), flags: unknown[] = [];
  async function visit(path: string) {
    if (visited.has(path)) return;
    visited.add(path);
    const source = await readFile(path, "utf8");
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const imports: Array<{ value: string; line: number }> = [];
    function walk(node: ts.Node) {
      let value: ts.Expression | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) value = node.moduleSpecifier;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        value = node.arguments[0];
        if (!value || !ts.isStringLiteralLike(value)) flags.push({ file: relative(workspace, path), kind: "nonliteral_module_path", line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
      if (value && ts.isStringLiteralLike(value) && value.text.startsWith(".")) imports.push({ value: value.text, line: file.getLineAndCharacterOfPosition(value.getStart()).line + 1 });
      ts.forEachChild(node, walk);
    }
    walk(file);
    for (const item of imports) {
      const base = resolve(dirname(path), item.value);
      const variants = [base, ...[".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", "/index.ts", "/index.js"].map(extension => base + extension), base.replace(/\.js$/, ".ts")];
      const target = variants.find(candidate => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate));
      if (!target) continue;
      const name = relative(workspace, target);
      if (isExcluded(name)) flags.push({ file: relative(workspace, path), line: item.line, target: name, kind: "reachable_excluded_source" });
      if (name.startsWith("src/")) await visit(target);
    }
  }
  if (existsSync(join(workspace, "src/index.ts"))) await visit(join(workspace, "src/index.ts"));
  else flags.push({ kind: "missing_standard_entrypoint_requires_manual_inspection" });
  records.push({ candidate_id: task.candidate_id, inspectedPaths: [...visited].map(path => relative(workspace, path)), flags });
}
const output = { recordedAt: new Date().toISOString(), purpose: "Inspect possible source packaging omissions, never code quality", limitation: "Static literal imports from src/index.ts only; dynamic loading, aliases or other entry points require manual inspection.", records };
await writeFile(join(root, "packaging-audit.json"), JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ inspected: records.length, flagged: records.filter(record => record.flags.length) }));
