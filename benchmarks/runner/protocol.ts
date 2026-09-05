export type Variant = "baseline" | "kamae";
export type Phase = "design" | "implementation";

export function order(repetition: number): Variant[] {
  return repetition % 2 === 1 ? ["baseline", "kamae"] : ["kamae", "baseline"];
}

export function prompt(phase: Phase, variant: Variant): string {
  const shared = `Work only in this workspace. Read PRD.md and src/contract.ts.
Use only the supplied workspace materials; do not inspect parent directories,
user-global rules, other projects, other runs, or external websites.
Make reasonable assumptions and record them; this is an unattended benchmark.
Do not commit, publish, delegate, or install dependencies. Dependencies are supplied.
Do not modify PRD.md, package.json, bun.lock, tsconfig.json, src/contract.ts,
or the supplied skill files. Write application code and tests under src/.
`;
  const guidance = variant === "kamae"
    ? "Use the $kamae skill at .agents/skills/kamae/SKILL.md and its relevant guides. Only the supplied .agents/rules defaults apply; do not load user-global rules.\n"
    : "";
  return shared + guidance + (phase === "design"
    ? `First produce DESIGN.md only; do not implement yet. Include:
1. Requirements and assumptions, with a requirement-to-module/test mapping.
2. Proposed files, responsibilities, dependencies, and public/internal types.
3. State transitions, invariants, and how invalid operations are prevented.
4. Boundary validation, business failures, unexpected faults, and privacy.
5. Test strategy, tradeoffs, and one alternative with reasons for the choice.
Use concrete TypeScript signatures or diagrams where useful. Keep it reviewable.
`
    : `Implement the supplied DESIGN.md and every requirement in PRD.md.
Do not edit DESIGN.md; it is the frozen proposal from the design phase.
Export the required adapter from src/index.ts. Write meaningful tests in src/.
Run bun run typecheck and bun test ./src, and fix failures within this session.
Write IMPLEMENTATION.md mapping the design to actual files, explaining deviations,
listing validation performed, and documenting remaining limitations.
`);
}

export function codexArgs(options: {
  binary: string; model: string; effort: string; workspace: string;
  finalMessage: string; disabledSkills: string[];
}): string[] {
  const settings = [
    "project_doc_max_bytes=0", "web_search=\"disabled\"",
    "features.plugins=false", "features.apps=false", "features.hooks=false",
    "features.memories=false", "features.multi_agent=false", "features.skill_search=false",
    `model_reasoning_effort=${JSON.stringify(options.effort)}`,
    `skills.config=[${options.disabledSkills.map(path => `{path=${JSON.stringify(path)},enabled=false}`).join(",")}]`,
  ];
  return [options.binary, "exec", "--ignore-user-config", "--ephemeral",
    "--skip-git-repo-check", "--sandbox", "workspace-write",
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
| Requirements | R1–R8 traced to concrete modules and tests | | |
| State invariants | Invalid states/operations prevented; actual signatures and guards | | |
| Boundaries | Commands, stored records, and gateway results validated | | |
| Failures | Business recovery distinct from unexpected faults | | |
| Privacy | Email exposure restricted; diagnostics and error paths considered | | |
| Maintainability | Responsibilities, dependencies, and complexity justified | | |
| Design fidelity | Implementation follows proposal or explains deviations | | |
| Tests | Positive, negative, failure, and transition paths asserted | | |

Record architectural differences separately: class/function organization,
discriminated unions, brands, schema-derived types, Result usage, pure transitions,
and runtime PII wrappers. These are descriptive observations, not automatic points.
Do not reward a keyword, library choice, or number of files by itself.

Overall assessment and limitations:

Reviewer / date:
`;
