import { describe, expect, test } from "bun:test";
import { inspect } from "node:util";
import { createExpenseService } from "../src/index";
import type { Dependencies } from "./contract";

const draft = {
  op: "create", id: "expense-1", ownerId: "alice",
  ownerEmail: "alice.private@example.com", description: "Train ticket", amountCents: 4200,
};

function harness(overrides: Partial<Dependencies> = {}) {
  const records = new Map<string, unknown>();
  const writes: unknown[] = [], charges: unknown[] = [], logs: unknown[] = [];
  const dependencies: Dependencies = {
    repository: {
      get: async (id) => records.has(id) ? JSON.parse(JSON.stringify(records.get(id))) : undefined,
      save: async (id, record) => { writes.push(record); records.set(id, JSON.parse(JSON.stringify(record))); },
    },
    payment: { charge: async (input) => { charges.push(input); return { kind: "paid", receiptId: "receipt-1" }; } },
    logger: { info: (event) => { logs.push(event); } },
    ...overrides,
  };
  const service = createExpenseService(dependencies);
  const step = (op: string, fields: Record<string, unknown> = {}) =>
    service.handle({ op, id: draft.id, actorId: "bob", ...fields });
  const approved = async () => {
    expect((await service.handle(draft)).status).toBe(201);
    expect((await step("submit", { actorId: "alice" })).status).toBe(200);
    expect((await step("approve")).status).toBe(200);
  };
  return { service, dependencies, records, writes, charges, logs, step, approved };
}

describe("PRD acceptance", () => {
  test("R1 creates and retrieves a public draft view", async () => {
    const h = harness();
    const created = await h.service.handle(draft);
    expect(created).toMatchObject({ status: 201, body: {
      id: draft.id, ownerId: "alice", description: draft.description,
      amountCents: 4200, state: "draft",
    } });
    expect(JSON.stringify(created)).not.toContain(draft.ownerEmail);
    expect(await h.step("get")).toEqual({ status: 200, body: created.body });
    expect(h.writes).toHaveLength(1);
  });

  test("R1 rejects malformed commands before side effects", async () => {
    const h = harness();
    for (const input of [null, [], "create", {}, { op: "unknown" },
      ...[0, -1, 1.5, 1000001, "4200", NaN, Infinity].map(amountCents => ({ ...draft, amountCents })),
      { ...draft, ownerEmail: "bad" }, { ...draft, description: "  " },
      { ...draft, id: "" }, { ...draft, ownerId: "" },
      { op: "submit", id: "missing" }, { op: "reject", id: "missing", actorId: "bob", reason: " " },
    ]) expect((await h.service.handle(input)).status).toBe(400);
    expect(h.writes).toHaveLength(0); expect(h.charges).toHaveLength(0);
  });

  test("R1 accepts inclusive amount limits", async () => {
    const h = harness();
    for (const amountCents of [1, 1000000]) {
      expect((await h.service.handle({ ...draft, id: `limit-${amountCents}`, amountCents })).status).toBe(201);
    }
  });

  test("R1 duplicate ID preserves the original expense", async () => {
    const h = harness(); const created = await h.service.handle(draft);
    expect((await h.service.handle({ ...draft, amountCents: 10 })).status).toBe(409);
    expect((await h.step("get")).body).toEqual(created.body);
    expect(h.writes).toHaveLength(1);
  });

  test("R2 only the owner submits a draft", async () => {
    const h = harness(); await h.service.handle(draft);
    expect((await h.step("submit")).status).toBe(403);
    expect((await h.step("submit", { actorId: "alice" })).body).toMatchObject({ state: "submitted" });
    expect((await h.step("submit", { actorId: "alice" })).status).toBe(409);
  });

  test("R3 blocks self approval and self rejection", async () => {
    const h = harness(); await h.service.handle(draft);
    await h.step("submit", { actorId: "alice" });
    for (const op of ["approve", "reject"]) {
      expect((await h.step(op, { actorId: "alice", reason: "No" })).status).toBe(403);
    }
    expect((await h.step("get")).body).toMatchObject({ state: "submitted" });
  });

  test("R3 rejection records reviewer and reason and is terminal", async () => {
    const h = harness(); await h.service.handle(draft);
    await h.step("submit", { actorId: "alice" });
    expect((await h.step("reject", { reason: " " })).status).toBe(400);
    expect((await h.step("reject", { reason: "No receipt" })).body).toMatchObject({
      state: "rejected", reviewerId: "bob", reason: "No receipt",
    });
    for (const op of ["submit", "approve", "reject", "pay"]) {
      expect((await h.step(op, { actorId: op === "submit" ? "alice" : "bob", reason: "Still no" })).status).toBe(409);
    }
    expect(h.charges).toHaveLength(0);
  });

  test("R4 approval and payment preserve expense data", async () => {
    const h = harness(); await h.approved(); const paid = await h.step("pay");
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ state: "paid", reviewerId: "bob", receiptId: "receipt-1", amountCents: 4200 });
    expect(h.charges).toEqual([{
      expenseId: draft.id, amountCents: 4200, email: draft.ownerEmail, idempotencyKey: draft.id,
    }]);
    expect(await h.step("get")).toEqual(paid);
  });

  test("R4 repeated payment neither charges nor saves", async () => {
    const h = harness(); await h.approved();
    const paid = await h.step("pay"); const count = h.writes.length;
    expect(await h.step("pay")).toEqual(paid);
    expect(h.charges).toHaveLength(1); expect(h.writes).toHaveLength(count);
    for (const op of ["submit", "approve", "reject"]) {
      expect((await h.step(op, { actorId: op === "submit" ? "alice" : "bob", reason: "No" })).status).toBe(409);
    }
  });

  test("R5 a decline remains approved and can retry", async () => {
    let count = 0;
    const h = harness({ payment: { charge: async () => ++count === 1
      ? { kind: "declined" } : { kind: "paid", receiptId: "retry-receipt" } } });
    await h.approved(); const writes = h.writes.length;
    expect(await h.step("pay")).toEqual({ status: 422, body: { code: "payment_declined" } });
    expect(h.writes).toHaveLength(writes);
    expect((await h.step("get")).body).toMatchObject({ state: "approved" });
    expect((await h.step("pay")).body).toMatchObject({ state: "paid", receiptId: "retry-receipt" });
  });

  test("R5 unavailable gateway returns 500 without writing", async () => {
    const h = harness({ payment: { charge: async () => { throw new Error("gateway offline"); } } });
    await h.approved(); const writes = h.writes.length;
    expect((await h.step("pay")).status).toBe(500);
    expect(h.writes).toHaveLength(writes);
    expect((await h.step("get")).body).toMatchObject({ state: "approved" });
  });

  test("R5 unusable gateway receipts return 500 without writing", async () => {
    for (const response of [undefined, {}, { kind: "paid" }, { kind: "paid", receiptId: "" }, { kind: "other" }]) {
      const h = harness({ payment: { charge: async () => response } });
      await h.approved(); const writes = h.writes.length;
      expect((await h.step("pay")).status).toBe(500);
      expect(h.writes).toHaveLength(writes);
    }
  });

  test("R5 unavailable storage returns 500", async () => {
    const h = harness({ repository: {
      get: async () => { throw new Error("read unavailable"); }, save: async () => {},
    } });
    expect((await h.step("get")).status).toBe(500);
    const writer = harness({ repository: {
      get: async () => undefined, save: async () => { throw new Error("write unavailable"); },
    } });
    expect((await writer.service.handle(draft)).status).toBe(500);
  });

  test("R7 storage and gateway errors do not expose email", async () => {
    const h = harness({ payment: { charge: async () => { throw new Error(draft.ownerEmail); } } });
    await h.approved();
    const failed = await h.step("pay");
    expect(failed.status).toBe(500);
    expect(JSON.stringify([failed, h.logs])).not.toContain(draft.ownerEmail);
    const storage = harness({ repository: {
      get: async () => { throw new Error(draft.ownerEmail); }, save: async () => {},
    } });
    const missing = await storage.step("get");
    expect(missing.status).toBe(500);
    expect(JSON.stringify([missing, storage.logs])).not.toContain(draft.ownerEmail);
  });

  test("R6 missing IDs return 404", async () => {
    const h = harness();
    for (const op of ["get", "submit", "approve", "reject", "pay"]) {
      expect((await h.step(op, { reason: "No receipt" })).status).toBe(404);
    }
  });

  test("R6 expenses cannot skip approval or move backwards", async () => {
    const h = harness(); await h.service.handle(draft);
    for (const op of ["approve", "reject", "pay"]) expect((await h.step(op, { reason: "No" })).status).toBe(409);
    await h.step("submit", { actorId: "alice" });
    expect((await h.step("pay")).status).toBe(409);
    await h.step("approve");
    for (const op of ["submit", "approve", "reject"]) {
      expect((await h.step(op, { actorId: op === "submit" ? "alice" : "bob", reason: "No" })).status).toBe(409);
    }
    expect(h.charges).toHaveLength(0);
  });

  test("R4/R6 saved expenses survive service recreation", async () => {
    const h = harness(); await h.approved(); const paid = await h.step("pay");
    const recreated = createExpenseService(h.dependencies);
    expect(await recreated.handle({ op: "get", id: draft.id })).toEqual(paid);
    expect(await recreated.handle({ op: "pay", id: draft.id })).toEqual(paid);
    expect(h.charges).toHaveLength(1);
  });

  test("R7 public output and success diagnostics contain no email", async () => {
    const h = harness(); await h.approved(); const paid = await h.step("pay");
    expect(JSON.stringify(paid)).not.toContain(draft.ownerEmail);
    expect(h.logs.length).toBeGreaterThanOrEqual(4);
    for (const log of h.logs) {
      for (const rendered of [JSON.stringify(log), inspect(log, { depth: null }), String(log)]) {
        expect(rendered).not.toContain(draft.ownerEmail);
      }
    }
    expect(JSON.stringify(h.logs)).toContain(draft.id);
  });

  test("R7 invalid commands do not leak email", async () => {
    const h = harness(); const response = await h.service.handle({ ...draft, amountCents: -1 });
    expect(response.status).toBe(400);
    expect(JSON.stringify([response, h.logs])).not.toContain(draft.ownerEmail);
    expect(inspect(h.logs, { depth: null })).not.toContain(draft.ownerEmail);
  });
});
