import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { read } from "../../runner/files";

// Treatment-delivery evidence only, never a source-string quality score.
const root = import.meta.dir;
const manifest = JSON.parse(await read(join(root, "manifest.json")));
const records = [];
for (const task of manifest.tasks) {
  const folder = join(root, "runs", task.candidate_id);
  const generation = JSON.parse(await read(join(folder, "generation.json")) || "null");
  if (generation?.status !== "completed") continue;
  const commandItems = (await read(join(folder, "implementation.stdout"))).split("\n").filter(Boolean)
    .map(line => JSON.parse(line)).filter(event => event.type === "item.completed" && event.item?.type === "command_execution").map(event => event.item);
  const paths = Object.keys(generation.stage.inputHashes).filter(path => path.startsWith(".agents/skills/") || path.startsWith(".agents/rules/"));
  const skill = (await read(join(folder, "workspace/.agents/skills/kamae/SKILL.md"))).trim();
  const exactSkillRead = skill ? commandItems.filter(item => item.exit_code === 0 && item.aggregated_output?.includes(skill)).map(item => item.command) : [];
  records.push({ candidate_id: task.candidate_id, ref: task.ref, guidanceInputPaths: paths,
    fullMainSkillPresentInSuccessfulToolOutput: skill ? exactSkillRead.length > 0 : null,
    matchingReadCommands: exactSkillRead,
    baselineHasNoGuidanceFiles: task.ref === "baseline" ? paths.length === 0 : null });
}
const value = { recordedAt: new Date().toISOString(), records, limitation: "Exact guidance bytes in a successful tool result establish delivery, not attention, adherence, quality, or actual remote request capture." };
await writeFile(join(root, "exposure-audit.json"), JSON.stringify(value, null, 2) + "\n");
console.log(JSON.stringify({ inspected: records.length, treated: records.filter(record => record.ref !== "baseline").length,
  fullSkillDeliveryRecorded: records.filter(record => record.fullMainSkillPresentInSuccessfulToolOutput).length,
  baseline: records.filter(record => record.ref === "baseline").length,
  unconfirmed: records.filter(record => record.ref === "baseline" ? !record.baselineHasNoGuidanceFiles : !record.fullMainSkillPresentInSuccessfulToolOutput).map(record => record.candidate_id) }));
