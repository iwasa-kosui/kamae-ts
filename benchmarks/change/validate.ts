import { read } from "../runner/files";
import { resolve, sep } from "node:path";
import { realpath, stat } from "node:fs/promises";

// This validates evidence references and decision bookkeeping, not code quality.
export async function reviewIssues(doc: any, id: string, requirements: string[], workspace: string,
  productionFiles: string[], critique?: any): Promise<string[]> {
  const issues: string[] = [];
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const stringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === "string");
  if (!doc || !stringList(doc.files_read) ||
      !["requirements", "findings", "implemented_changes", "preserved_consumers"].every(key => Array.isArray(doc[key])) ||
      doc.requirements.some((item: any) => !item || !text(item.id) || !stringList(item.finding_ids)) ||
      doc.findings.some((item: any) => !item || !text(item.id) || !stringList(item.requirement_ids)) ||
      (critique && (!Array.isArray(doc.decisions) || doc.decisions.some((item: any) => !item || !text(item.finding_id))))) {
    return ["Malformed review bookkeeping fields"];
  }
  if (doc.candidate_id !== id) issues.push("Wrong candidate ID");
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) issues.push(`Duplicate ${label}`);
  };
  unique(doc.files_read, "files_read paths");
  for (const path of productionFiles) if (!doc.files_read.includes(path)) issues.push(`Unaccounted production file: ${path}`);
  const ids = doc.requirements.map((item: any) => item.id);
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...requirements].sort())) issues.push("Requirement coverage differs from contract");
  unique(doc.findings.map((item: any) => item.id), "finding IDs");

  const obligations = new Map<string, any>(doc.requirements.map((item: any) => [item.id, item]));
  const findings = new Map<string, any>(doc.findings.map((item: any) => [item.id, item]));
  const root = await realpath(workspace);
  const sources = new Set(productionFiles.filter(path => path.startsWith("before/src/") || path.startsWith("after/src/")));
  const contracts = new Set(["API.md", "CHANGE.md"]);
  const lineCounts = new Map<string, number | null>();

  async function evidence(value: any, label: string, required: boolean, sourceRequired: boolean) {
    if (!Array.isArray(value)) { issues.push(`Missing evidence array: ${label}`); return; }
    if (required && !value.length) issues.push(`Missing evidence: ${label}`);
    let validSource = false;
    for (const citation of value) {
      if (!citation || !text(citation.file) || (!sources.has(citation.file) && !contracts.has(citation.file))) {
        issues.push(`Evidence is not a packaged source or contract: ${label}/${citation?.file}`);
        continue;
      }
      if (!text(citation.explanation)) issues.push(`Missing evidence explanation: ${label}/${citation.file}`);
      if (!lineCounts.has(citation.file)) {
        let count: number | null = null;
        const path = resolve(root, citation.file);
        try {
          const canonical = await realpath(path);
          // The package inventory contains regular files, not aliases into another artifact.
          if (canonical === path && canonical.startsWith(root + sep) && (await stat(canonical)).isFile()) {
            const content = await read(canonical);
            if (content) count = content.split("\n").length;
          }
        } catch { /* An unavailable source is a bookkeeping issue, not evidence. */ }
        lineCounts.set(citation.file, count);
      }
      const count = lineCounts.get(citation.file);
      if (count === null || count === undefined || !Number.isInteger(citation.line_start) ||
          !Number.isInteger(citation.line_end) || citation.line_start < 1 ||
          citation.line_end < citation.line_start || citation.line_end > count) {
        issues.push(`Unavailable evidence: ${citation.file}:${citation.line_start}-${citation.line_end}`);
      } else if (sources.has(citation.file)) validSource = true;
    }
    if (sourceRequired && !validSource) issues.push(`Missing production-source evidence: ${label}`);
  }

  for (const item of doc.requirements) {
    if (!["supported", "correction_needed", "unverified"].includes(item.status)) issues.push(`Invalid requirement status: ${item.id}`);
    if (!text(item.rationale)) issues.push(`Missing requirement rationale: ${item.id}`);
    unique(item.finding_ids, `finding references for ${item.id}`);
    await evidence(item.evidence, `requirement ${item.id}`, item.status !== "unverified", item.status !== "unverified");
    for (const fid of item.finding_ids) {
      const finding = findings.get(fid);
      if (!finding || !finding.requirement_ids.includes(item.id)) issues.push(`Invalid finding reference: ${item.id}/${fid}`);
    }
    if (item.status === "supported" && item.finding_ids.length) issues.push(`Supported requirement references a finding: ${item.id}`);
    if (item.status === "correction_needed" && !item.finding_ids.length) issues.push(`Missing correction evidence: ${item.id}`);
  }
  for (const finding of doc.findings) {
    if (!finding.requirement_ids.length || finding.requirement_ids.some((rid: string) => !requirements.includes(rid))) issues.push(`Invalid obligation: ${finding.id}`);
    unique(finding.requirement_ids, `obligations for ${finding.id}`);
    await evidence(finding.evidence, `finding ${finding.id}`, true, true);
    for (const field of ["claim", "call_path", "counterexample", "actual_behavior", "required_behavior", "consequence", "minimal_correction"])
      if (!text(finding[field])) issues.push(`Missing ${field}: ${finding.id}`);
    for (const rid of finding.requirement_ids) {
      const requirement = obligations.get(rid);
      // A critic may leave a proposed correction unverified; retained final findings are established corrections.
      const validStatus = critique
        ? requirement?.status === "correction_needed"
        : ["correction_needed", "unverified"].includes(requirement?.status);
      if (!validStatus || !requirement?.finding_ids.includes(finding.id))
        issues.push(`Finding not reflected in affected requirement: ${finding.id}/${rid}`);
    }
  }
  for (const item of doc.implemented_changes)
    await evidence(item?.evidence, "implemented change", true, true);
  for (const item of doc.preserved_consumers)
    await evidence(item?.evidence, "preserved consumer", true, true);

  if (critique) {
    const proposed = new Map<string, any>(critique.findings.map((item: any) => [item.id, item]));
    const decisions = new Map<string, any>(doc.decisions.map((item: any) => [item.finding_id, item]));
    unique(doc.decisions.map((item: any) => item.finding_id), "decision IDs");
    if (JSON.stringify([...decisions.keys()].sort()) !== JSON.stringify([...proposed.keys()].sort())) issues.push("Decision IDs differ from proposals");
    for (const [fid, decision] of decisions) {
      if (!["accepted", "narrowed", "rejected", "duplicate", "unresolved"].includes(decision.verdict)) issues.push(`Invalid decision verdict: ${fid}`);
      if (!text(decision.reason)) issues.push(`Missing decision reason: ${fid}`);
      const retained = ["accepted", "narrowed"].includes(decision.verdict);
      await evidence(decision.evidence, `decision ${fid}`, decision.verdict !== "unresolved", retained);
      if (retained !== findings.has(fid)) issues.push(`Decision/finding contradiction: ${fid}`);
      if (decision.verdict === "duplicate" && (!decision.duplicate_of || !findings.has(decision.duplicate_of) || decision.duplicate_of === fid))
        issues.push(`Invalid duplicate target: ${fid}`);
      if (decision.verdict !== "duplicate" && decision.duplicate_of !== null) issues.push(`Unexpected duplicate target: ${fid}`);
      if (decision.verdict === "unresolved") {
        for (const rid of proposed.get(fid)?.requirement_ids ?? []) {
          const requirement = obligations.get(rid);
          const confirmed = [...findings.values()].some(finding =>
            finding.requirement_ids.includes(rid) && requirement?.finding_ids.includes(finding.id));
          if (requirement?.status !== (confirmed ? "correction_needed" : "unverified"))
            issues.push(`Unresolved proposal contradicts requirement: ${fid}/${rid}`);
        }
      }
    }
    for (const fid of findings.keys()) if (!proposed.has(fid) && !fid.startsWith("N")) issues.push(`New finding must use N prefix: ${fid}`);
    const expected = doc.findings.length ? "correction_needed" : doc.requirements.some((req: any) => req.status === "unverified") ? "unverified" : "supported";
    if (doc.outcome !== expected) issues.push("Outcome contradicts requirement/finding judgments");
  }
  return issues;
}

export function combineCritiques(a: any, b: any) {
  const obligations = (review: any, prefix: string) => review.requirements.map((req: any) => ({ ...req,
    finding_ids: req.finding_ids.map((id: string) => `${prefix}_${id}`) }));
  return { findings: [a, b].flatMap((review, index) => review.findings.map((finding: any) => ({ ...finding, id: `${index === 0 ? "A" : "B"}_${finding.id}` }))),
    requirements_from_a: obligations(a, "A"), requirements_from_b: obligations(b, "B"),
    uncertainties_from_a: a.uncertainties, uncertainties_from_b: b.uncertainties };
}
