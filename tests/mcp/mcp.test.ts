import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { pkceOk, redirectAllowed, sign, verify } from "../../lib/mcp/oauth";
import { handleRpc } from "../../lib/mcp/server";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("oauth tokens", () => {
  it("a token verifies only as its own kind, unchanged and before it expires", () => {
    const now = Date.now();
    const code = sign("code", "u1", { cc: "abc", ru: "http://localhost/cb", cid: "c1" }, now);
    expect(verify(code, "code", now)).toMatchObject({ sub: "u1", cc: "abc", ru: "http://localhost/cb", cid: "c1" });
    expect(verify(code, "access", now)).toBeNull();
    expect(verify(code, "code", now + 61_000)).toBeNull();

    const [body, sig] = sign("access", "u1", {}, now).split(".");
    const forged = Buffer.from(JSON.stringify({ k: "access", sub: "admin", exp: 9e9 })).toString("base64url");
    expect(verify(`${forged}.${sig}`, "access", now)).toBeNull();
    expect(verify(body, "access", now)).toBeNull();
    expect(verify(null, "access", now)).toBeNull();
  });
  it("PKCE matches only the verifier the challenge was made from", () => {
    const challenge = createHash("sha256").update("verifier").digest("base64url");
    expect(pkceOk("verifier", challenge)).toBe(true);
    expect(pkceOk("other", challenge)).toBe(false);
  });
  it.each([
    ["https://claude.ai/api/mcp/auth_callback", true],
    ["http://localhost:6274/oauth/callback", true],
    ["https://claude.ai.evil.com/api/mcp/auth_callback", false],
    ["https://evil.com/cb", false],
    ["http://evil.com/cb", false],
    ["not a url", false],
  ])("redirect %s allowed: %s", (uri, ok) => expect(redirectAllowed(uri)).toBe(ok));
});

describe("mcp server", () => {
  const row = { id: 7, code: "CR-B-04", topic: "feed", rule: "r", summary: null, details: { on_fail: "skip" }, givenOn: new Date("2026-11-23"), newRuleId: null, deletedAt: null };
  const fakeDb = (changed: number, old: object | null = { ...row, id: 3, topic: "old topic", rule: "old wording" }) => {
    const mdRules = {
      create: vi.fn(async () => row),
      updateMany: vi.fn(async () => ({ count: changed })),
      findMany: vi.fn(async () => [row]),
      findFirst: vi.fn(async () => old),
    };
    const setting = { findMany: vi.fn(async () => [{ value: { scope: "s" } }]) };
    const kgpLot = {
      findMany: vi.fn(async () => [{ lotNo: "PL-001" }]),
      count: vi.fn(async () => 25),
      updateMany: vi.fn(async () => ({ count: changed })),
      findUnique: vi.fn(async () => ({ lotNo: "PL-001", runOrder: 2 })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { mdRules, setting, kgpLot, $transaction: (fn: (tx: unknown) => unknown) => fn({ mdRules }) } as any;
  };
  const call = (db: unknown, name: string, args: object) =>
    handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, db as never) as Promise<{
      result: { isError?: boolean; content: { text: string }[] };
    }>;

  it("initialize answers with the asked version; a notification gets no reply", async () => {
    const res = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, fakeDb(1));
    expect(res).toMatchObject({ id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } } });
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, fakeDb(1))).toBeNull();
  });
  it("tools/list gives each tool a JSON schema", async () => {
    const res = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, fakeDb(1))) as { result: { tools: { name: string; inputSchema: { type: string } }[] } };
    expect(res.result.tools.map((t) => t.name)).toEqual(["list_rules", "create_rule", "update_rule", "delete_rule", "save_summary", "update_club_lot", "update_club_order", "list_data", "read_data"]);
    expect(res.result.tools.every((t) => t.inputSchema.type === "object")).toBe(true);
  });
  it("list_rules hides replaced rules unless asked", async () => {
    const db = fakeDb(1);
    const res = await call(db, "list_rules", {});
    expect(JSON.parse(res.result.content[0].text)).toEqual({
      rulesets: [{ scope: "s" }],
      rules: [
        { id: 7, code: "CR-B-04", topic: "feed", rule: "r", summary: null, details: { on_fail: "skip" }, given_on: "2026-11-23", status: "in force", replaced_by: null },
      ],
    });
    expect(db.mdRules.findMany.mock.calls[0][0].where).toEqual({ newRuleId: null, deletedAt: null });
  });
  it("update_rule copies what it is not given from the old rule and marks the old one; a rule not in force is an error", async () => {
    const db = fakeDb(1);
    const ok = await call(db, "update_rule", { id: 3, rule: "new wording" });
    expect(ok.result.isError).toBeUndefined();
    expect(db.mdRules.create.mock.calls[0][0].data).toMatchObject({ code: "CR-B-04", topic: "old topic", rule: "new wording" });
    expect(db.mdRules.updateMany).toHaveBeenCalledWith({ where: { id: 3, newRuleId: null, deletedAt: null }, data: { newRuleId: 7 } });

    const gone = fakeDb(1, null);
    expect((await call(gone, "update_rule", { id: 3, rule: "x" })).result.isError).toBe(true);
    expect(gone.mdRules.create).not.toHaveBeenCalled();
    expect((await call(fakeDb(0), "update_rule", { id: 3, rule: "x" })).result.isError).toBe(true);
  });
  it("delete_rule only marks a rule in force as deleted", async () => {
    const db = fakeDb(1);
    expect(JSON.parse((await call(db, "delete_rule", { id: 3 })).result.content[0].text)).toEqual({ id: 3, status: "deleted" });
    expect(db.mdRules.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 3, newRuleId: null, deletedAt: null }, data: { deletedAt: expect.any(Date) } });
    expect((await call(fakeDb(0), "delete_rule", { id: 3 })).result.isError).toBe(true);
  });
  it("read_data reads a listed table by known columns only", async () => {
    const db = fakeDb(1);
    const ok = await call(db, "read_data", { table: "club_lots", where: { approvedByMd: true }, order_by: "runOrder", limit: 5 });
    expect(JSON.parse(ok.result.content[0].text)).toEqual({ table: "club_lots", total: 25, offset: 0, rows: [{ lotNo: "PL-001" }] });
    expect(db.kgpLot.findMany).toHaveBeenCalledWith({ where: { approvedByMd: true }, orderBy: { runOrder: "asc" }, take: 5, skip: 0 });

    expect((await call(db, "read_data", { table: "club_lots", where: { password: "x" } })).result.isError).toBe(true);
    expect((await call(db, "read_data", { table: "users" })).result.isError).toBe(true);
    expect((await call(db, "read_data", { table: "club_lots", where: { lotNo: { contains: "P" } } })).result.isError).toBe(true);
    expect(db.kgpLot.findMany).toHaveBeenCalledTimes(1);
  });
  it("update_club_lot writes only the fields given; an unknown lot, no fields or a calculated field is an error", async () => {
    const db = fakeDb(1);
    const ok = await call(db, "update_club_lot", { lot_no: "PL-001", run_order: 2, remarks: null });
    expect(JSON.parse(ok.result.content[0].text)).toEqual({ lotNo: "PL-001", runOrder: 2 });
    expect(db.kgpLot.updateMany.mock.calls[0][0].where).toEqual({ lotNo: "PL-001" });
    expect(JSON.parse(JSON.stringify(db.kgpLot.updateMany.mock.calls[0][0].data))).toEqual({ runOrder: 2, remarks: null });

    expect((await call(fakeDb(0), "update_club_lot", { lot_no: "PL-999", status: "x" })).result.isError).toBe(true);
    const none = fakeDb(1);
    expect((await call(none, "update_club_lot", { lot_no: "PL-001" })).result.isError).toBe(true);
    expect((await call(none, "update_club_lot", { lot_no: "PL-001", balance_km: 3 })).result.isError).toBe(true);
    expect(none.kgpLot.updateMany).not.toHaveBeenCalled();
  });
  it("bad arguments are a tool error and nothing is written", async () => {
    const db = fakeDb(1);
    const res = await call(db, "create_rule", { topic: "", rule: "x" });
    expect(res.result.isError).toBe(true);
    expect(db.mdRules.create).not.toHaveBeenCalled();
  });
});
