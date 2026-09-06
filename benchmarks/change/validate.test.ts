import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { combineCritiques, reviewIssues } from "./validate";

const production = ["before/src/index.ts", "after/src/index.ts"];
const citation = (file = "after/src/index.ts") => ({
  file, line_start: 1, line_end: 1, explanation: "This is the cited source location.",
});
const requirement = (id: string, status = "supported", finding_ids: string[] = []) => ({
  id, status, finding_ids, rationale: "The assessment is supported by the cited path.",
  evidence: [citation()],
});
const finding = (id: string, requirement_ids = ["B1"]) => ({
  id, requirement_ids, kind: "regression", impact: "localized_violation",
  claim: "A documented branch requires correction.", evidence: [citation()],
  call_path: "entry -> branch", counterexample: "A permitted input reaches the branch.",
  actual_behavior: "The branch produces the wrong documented result.",
  required_behavior: "The branch must produce the specified result.",
  consequence: "The requested operation is incorrect.",
  minimal_correction: "Correct the branch result.",
  regression_obligations: ["Reinspect the specified branch."],
  counterevidence: "No defeating branch was established.", confidence: "high",
});
const decision = (finding_id: string, verdict = "accepted") => ({
  finding_id, verdict, duplicate_of: null, reason: "The cited path supports this disposition.",
  evidence: [citation()],
});
const document = () => ({
  candidate_id: "C001", files_read: [...production],
  requirements: [requirement("B1"), requirement("C1")],
  findings: [] as ReturnType<typeof finding>[],
  implemented_changes: [{ claim: "The requested path is present.", evidence: [citation()] }],
  preserved_consumers: [{ consumer: "Existing entry", assessment: "Preserved.", evidence: [citation("before/src/index.ts")] }],
  overall_assessment: "The recorded obligations have been inspected.",
  uncertainties: [] as string[], outcome: "supported", decisions: [] as ReturnType<typeof decision>[],
});

async function fixture(check: (workspace: string) => Promise<void>) {
  const workspace = await mkdtemp(join(tmpdir(), "change-review-bookkeeping-"));
  try {
    for (const side of ["before", "after"]) {
      await mkdir(join(workspace, side, "src"), { recursive: true });
      await writeFile(join(workspace, side, "src/index.ts"), "export const value = true;\n");
    }
    await writeFile(join(workspace, "API.md"), "The host owns authentication.\n");
    await writeFile(join(workspace, "CHANGE.md"), "Preserve B1 and implement C1.\n");
    await writeFile(join(workspace, "AFTER.md"), "Combined source rendering.\n");
    await check(workspace);
  } finally { await rm(workspace, { recursive: true, force: true }); }
}

describe("review bookkeeping, without executing or judging candidate behavior", () => {
  test("accepts a complete supported judgment with real source references", async () => {
    await fixture(async workspace => {
      expect(await reviewIssues(document(), "C001", ["B1", "C1"], workspace, production, { findings: [] })).toEqual([]);
    });
  });

  test("does not allow an affected requirement to remain supported under a retained finding", async () => {
    await fixture(async workspace => {
      const doc = document(), proposed = finding("A_F1", ["B1", "C1"]);
      doc.findings = [proposed];
      doc.requirements[1] = requirement("C1", "correction_needed", ["A_F1"]);
      doc.decisions = [decision("A_F1")];
      doc.outcome = "correction_needed";
      const critique = { findings: [proposed] };
      const issues = await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, critique);
      expect(issues).toContain("Finding not reflected in affected requirement: A_F1/B1");
      doc.requirements[0] = requirement("B1", "correction_needed", ["A_F1"]);
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, critique)).toEqual([]);
    });
  });

  test("propagates unresolved proposals without overriding a separate confirmed correction", async () => {
    await fixture(async workspace => {
      const doc = document(), proposed = finding("A_F1");
      doc.decisions = [{ ...decision("A_F1", "unresolved"), evidence: [] }];
      const critique = { findings: [proposed] };
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, critique))
        .toContain("Unresolved proposal contradicts requirement: A_F1/B1");

      doc.requirements[0] = { ...requirement("B1", "unverified"), evidence: [],
        rationale: "The available source does not resolve this specific claim." };
      doc.outcome = "unverified";
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, critique)).toEqual([]);

      doc.findings = [finding("N1")];
      doc.requirements[0] = requirement("B1", "correction_needed", ["N1"]);
      doc.outcome = "correction_needed";
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, critique)).toEqual([]);
    });
  });

  test("requires source evidence for supported obligations and proposed corrections", async () => {
    await fixture(async workspace => {
      const doc = document();
      doc.requirements[0]!.evidence = [];
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production))
        .toContain("Missing production-source evidence: requirement B1");

      doc.requirements[0] = requirement("B1", "unverified", ["F1"]);
      doc.findings = [{ ...finding("F1"), evidence: [] }];
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production))
        .toContain("Missing production-source evidence: finding F1");
      doc.findings[0] = finding("F1");
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production)).toEqual([]);
    });
  });

  test("allows contract supplementation but not bundle or contract citations as production evidence", async () => {
    await fixture(async workspace => {
      const doc = document();
      doc.requirements[0]!.evidence = [citation("API.md")];
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production))
        .toContain("Missing production-source evidence: requirement B1");
      doc.requirements[0]!.evidence.push(citation());
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production)).toEqual([]);

      doc.requirements[0]!.evidence = [citation("AFTER.md")];
      expect((await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production))
        .some(issue => issue.includes("not a packaged source or contract"))).toBe(true);
    });
  });

  test("rejects source aliases, traversal spellings and unavailable line ranges", async () => {
    await fixture(async workspace => {
      await symlink(join(workspace, "API.md"), join(workspace, "after/src/alias.ts"));
      const doc = document(), paths = [...production, "after/src/alias.ts"];
      doc.files_read = paths;
      doc.requirements[0]!.evidence = [citation("after/src/alias.ts")];
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, paths))
        .toContain("Unavailable evidence: after/src/alias.ts:1-1");

      doc.files_read = production;
      doc.requirements[0]!.evidence = [citation("after/src/../../API.md")];
      expect((await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production))
        .some(issue => issue.includes("not a packaged source or contract"))).toBe(true);
      doc.requirements[0]!.evidence = [{ ...citation(), line_end: 99 }];
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production))
        .toContain("Unavailable evidence: after/src/index.ts:1-99");
    });
  });

  test("keeps a rejected finding out of final findings and permits contract-based rejection evidence", async () => {
    await fixture(async workspace => {
      const doc = document(), proposed = finding("A_F1");
      doc.decisions = [{ ...decision("A_F1", "rejected"), evidence: [citation("API.md")] }];
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, { findings: [proposed] })).toEqual([]);
      doc.findings = [proposed];
      doc.requirements[0] = requirement("B1", "correction_needed", ["A_F1"]);
      doc.outcome = "correction_needed";
      expect(await reviewIssues(doc, "C001", ["B1", "C1"], workspace, production, { findings: [proposed] }))
        .toContain("Decision/finding contradiction: A_F1");
    });
  });

  test("prefixes both critics' requirement references together with their findings", () => {
    const a = document(), b = document();
    a.findings = [finding("F1")];
    b.findings = [finding("F1")];
    a.requirements[0] = requirement("B1", "correction_needed", ["F1"]);
    b.requirements[0] = requirement("B1", "unverified", ["F1"]);
    const combined = combineCritiques(a, b);
    expect(combined.findings.map(item => item.id)).toEqual(["A_F1", "B_F1"]);
    expect(combined.requirements_from_a[0].finding_ids).toEqual(["A_F1"]);
    expect(combined.requirements_from_b[0].finding_ids).toEqual(["B_F1"]);
  });
});
