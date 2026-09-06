export const variants = ["baseline", "kamae", "kamae-ladder"] as const;
export type Variant = typeof variants[number];
export type Phase = "design" | "implementation";

export function order(repetition: number, selected: readonly Variant[] = ["baseline", "kamae"]): Variant[] {
  return repetition % 2 === 1 ? [...selected] : [...selected].reverse();
}

export function prompt(phase: Phase, variant: Variant): string {
  const shared = `Work only in this workspace. Read PRD.md and API.md.
Use only the supplied workspace materials; do not inspect parent directories,
user-global rules, other projects, other runs, or external websites.
Make reasonable assumptions and record them; this is an unattended benchmark.
Do not commit, publish, or delegate. Make your own design and library choices;
you are authorized to choose without asking for preferences or approval.
Do not modify PRD.md, API.md, tsconfig.json, or supplied skill files.
Write application code and tests under src/.
`;
  const guidance = variant !== "baseline"
    ? "Use the $kamae skill at .agents/skills/kamae/SKILL.md and its relevant guides. Only the supplied .agents/rules defaults apply; do not load user-global rules.\n"
    : "";
  const ladder = variant === "kamae-ladder"
    ? "Also read and apply LADDER.md. This adds a decision order to the supplied kamae guidance. Do not modify LADDER.md.\n"
    : "";
  return shared + guidance + ladder + (phase === "design"
    ? `First produce DESIGN.md; do not implement yet.
Describe the design you propose for this product and explain your choices.
You may edit only the dependencies field of package.json to select runtime
packages (exact registry versions). The runner installs them after this phase;
do not install packages yourself. No additional packages is also a valid choice.
`
    : `Implement the supplied DESIGN.md and every requirement in PRD.md.
Do not edit DESIGN.md; it is the frozen proposal from the design phase.
Export the required adapter from src/index.ts. Write meaningful tests in src/.
The selected dependencies have been installed. Do not edit package.json or bun.lock.
Run bun run typecheck and bun test ./src, and fix failures within this session.
Write IMPLEMENTATION.md mapping the design to actual files, explaining deviations,
listing validation performed, and documenting remaining limitations.
`);
}

export function codexArgs(options: {
  binary: string; model: string; effort: string; workspace: string;
  finalMessage: string; disabledSkills: string[]; externalSandbox?: boolean;
}): string[] {
  const settings = [
    "project_doc_max_bytes=0", "web_search=\"disabled\"",
    "features.plugins=false", "features.apps=false", "features.hooks=false",
    "features.memories=false", "features.multi_agent=false", "features.skill_search=false",
    "memories.use_memories=false", "memories.generate_memories=false",
    "features.enable_request_compression=false",
    `model_reasoning_effort=${JSON.stringify(options.effort)}`,
    `skills.config=[${options.disabledSkills.map(path => `{path=${JSON.stringify(path)},enabled=false}`).join(",")}]`,
  ];
  return [options.binary, "exec", "--ignore-user-config", "--ephemeral",
    "--skip-git-repo-check", "--sandbox", options.externalSandbox ? "danger-full-access" : "workspace-write",
    "-c", "approval_policy=\"never\"", "--json", "--color", "never",
    "--model", options.model, "--cd", options.workspace,
    "--output-last-message", options.finalMessage,
    ...settings.flatMap(value => ["-c", value]), "-"];
}

export const rubric = `# Design and implementation review

Review DESIGN.md alongside workspace/src and IMPLEMENTATION.md. Cite file:line
evidence for every rating. A design promise alone is not implementation evidence.
Use 0 (absent/contradicted), 1 (partial), or 2 (supported throughout).
Leave unrated criteria blank; do not treat missing review as zero or as passing.

| Dimension | Evidence to inspect | Rating | Evidence / rationale |
| --- | --- | --- | --- |
| Requirements | Product behavior supported by code and tests | | |
| Correctness | Behavior, edge cases, and data consistency | | |
| Reliability | Effects of failed operations and recovery | | |
| Privacy | The product's email exposure requirement | | |
| Maintainability | Responsibilities, dependencies, and complexity justified | | |
| Design fidelity | Implementation follows proposal or explains deviations | | |
| Tests | Positive, negative, failure, and transition paths asserted | | |

Record architectural and library differences separately, including approaches
that do not resemble the skill. These are observations, not automatic points.
Do not reward a keyword, library choice, or number of files by itself.

Overall assessment and limitations:

Reviewer / date:
`;
