const str = { type: "string" };
const list = (items: unknown) => ({ type: "array", items });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const choice = (values: string[]) => ({ type: "string", enum: values });
const evidence = list(object({ file: str, line_start: { type: "integer" }, line_end: { type: "integer" }, explanation: str }));

export function responseSchema(adjudicator: boolean, requirements: string[]) {
  const finding = object({ id: str, requirement_ids: list(choice(requirements)),
    kind: choice(["missing_change", "regression", "both"]),
    impact: choice(["blocked_required_outcome", "localized_violation"]), claim: str,
    evidence, call_path: str, counterexample: str, actual_behavior: str,
    required_behavior: str, consequence: str, minimal_correction: str,
    regression_obligations: list(str), counterevidence: str,
    confidence: choice(["high", "medium", "low"]) });
  const properties: Record<string, unknown> = {
    candidate_id: str, files_read: list(str),
    requirements: list(object({ id: choice(requirements),
      status: choice(["supported", "correction_needed", "unverified"]),
      rationale: str, evidence, finding_ids: list(str) })),
    findings: list(finding),
    implemented_changes: list(object({ claim: str, evidence })),
    preserved_consumers: list(object({ consumer: str, assessment: str, evidence })),
    overall_assessment: str, uncertainties: list(str),
  };
  if (adjudicator) {
    properties.outcome = choice(["supported", "correction_needed", "unverified"]);
    properties.decisions = list(object({ finding_id: str,
      verdict: choice(["accepted", "narrowed", "rejected", "duplicate", "unresolved"]),
      duplicate_of: { type: ["string", "null"] }, reason: str, evidence }));
  }
  return object(properties);
}
