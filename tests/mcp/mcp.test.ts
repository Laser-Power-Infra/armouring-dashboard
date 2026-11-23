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
  const row = { id: 7, code: "CR-B-04", topic: "feed", rule: "r", summary: null, details: { on_fail: "skip" }, givenOn: new Date("2026-11-23"), newRuleId: null };
  const fakeDb = (replaced: number) => {
    const mdRules = {
      create: vi.fn(async () => row),
      updateMany: vi.fn(async () => ({ count: replaced })),
      findMany: vi.fn(async () => [row]),
      findUnique: vi.fn(async () => ({ code: "CR-B-04" })),
    };
    const setting = { findMany: vi.fn(async () => [{ value: { scope: "s" } }]) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { mdRules, setting, $transaction: (fn: (tx: unknown) => unknown) => fn({ mdRules }) } as any;
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
    expect(res.result.tools.map((t) => t.name)).toEqual(["list_rules", "save_rule", "save_summary"]);
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
    expect(db.mdRules.findMany.mock.calls[0][0].where).toEqual({ newRuleId: null });
  });
  it("save_rule with replaces_id keeps the old code and marks the old rule; an already replaced rule is an error", async () => {
    const db = fakeDb(1);
    const ok = await call(db, "save_rule", { topic: "feed", rule: "new wording", replaces_id: 3 });
    expect(ok.result.isError).toBeUndefined();
    expect(db.mdRules.create.mock.calls[0][0].data.code).toBe("CR-B-04");
    expect(db.mdRules.updateMany).toHaveBeenCalledWith({ where: { id: 3, newRuleId: null }, data: { newRuleId: 7 } });

    const bad = await call(fakeDb(0), "save_rule", { topic: "feed", rule: "new wording", replaces_id: 3 });
    expect(bad.result.isError).toBe(true);
  });
  it("bad arguments are a tool error and nothing is written", async () => {
    const db = fakeDb(1);
    const res = await call(db, "save_rule", { topic: "", rule: "x" });
    expect(res.result.isError).toBe(true);
    expect(db.mdRules.create).not.toHaveBeenCalled();
  });
});
