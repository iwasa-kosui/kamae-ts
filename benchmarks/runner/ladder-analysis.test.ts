import { expect, test } from "bun:test";
import { median, sourceMetrics, usageMetrics } from "./ladder-analysis";
import type { RunResult } from "./run";

const stage = (input: number, output: number, cached?: number) => ({ exitCode: 0, timedOut: false,
  durationMs: 1000, completed: true, failed: false, toolCalls: 1, malformedLines: 0,
  usage: { input_tokens: input, output_tokens: output, ...(cached === undefined ? {} : { cached_input_tokens: cached }) } });
const run = (stages: RunResult["stages"]): RunResult => ({ id: "01-kamae", variant: "kamae", repetition: 1,
  status: "completed", integrity: true, designReview: "pending", stages });

test("cache is a subset of input and unknown cache is not free", () => {
  const measured = usageMetrics(run({ design: stage(100, 20, 60), implementation: stage(200, 30, 100) }), "gpt-5.4-mini");
  expect(measured.total).toBe(350);
  expect(measured.uncached).toBe(140);
  expect(measured.apiEquivalentUsd).toBeCloseTo((140 * 0.75 + 160 * 0.075 + 50 * 4.5) / 1e6, 10);
  expect(usageMetrics(run({ design: stage(100, 20), implementation: stage(100, 20) }), "gpt-5.5").apiEquivalentUsd).toBeNull();
  expect(usageMetrics(run({ design: stage(100, 20, 0) }), "gpt-5.5").total).toBeNull();
  expect(usageMetrics(run({ design: stage(300_000, 20, 0), implementation: stage(100, 20, 0) }), "gpt-5.5").apiEquivalentUsd).toBeNull();
});

test("AST count reveals line compression and byte count handles Unicode", () => {
  const compact = sourceMetrics("const a = 1; const b = 2;\n");
  const expanded = sourceMetrics("const a = 1;\nconst b = 2;\n");
  expect(compact.lines).toBe(1);
  expect(expanded.lines).toBe(2);
  expect(compact.statements).toBe(expanded.statements);
  expect(compact.variableDeclarations).toBe(2);
  expect(sourceMetrics("// 構え\n").bytes).toBe(Buffer.byteLength("// 構え\n"));
  expect(sourceMetrics("").lines).toBe(0);
  expect(median([])).toBeNull();
  expect(median([1, 20, 3])).toBe(3);
  expect(median([1, 3])).toBe(2);
});
