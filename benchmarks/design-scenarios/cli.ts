import { buildPack, prepare } from "./pack";

const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
  console.log("Scenario preparation only; no model execution or grading.\n  check\n  prepare --output NEW_DIRECTORY");
} else if (args.length === 1 && args[0] === "check") {
  const pack = await buildPack();
  for (const scenario of pack.scenarios) {
    console.log(`${scenario.metadata.id}: ${scenario.units.length} observation units; ${scenario.exclusions.length} explicit exclusions`);
  }
} else if (args.length === 3 && args[0] === "prepare" && args[1] === "--output" && args[2] && !args[2].startsWith("-")) {
  const manifest = await prepare(args[2]);
  console.log(`Prepared ${manifest.cases.length} scenarios at ${args[2]}. No model was invoked.`);
} else {
  throw new Error("Use check or prepare --output NEW_DIRECTORY. Model execution is not supported.");
}
