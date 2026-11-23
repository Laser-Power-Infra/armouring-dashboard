import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";

// The MCP server for MD sir's rules: JSON-RPC over one POST, no session, no streaming.
// shortcut: hand-written for three tools; move to @modelcontextprotocol/sdk when resources, prompts or streaming are needed.

type Db = Pick<PrismaClient, "mdRules" | "setting" | "$transaction">;

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "Rules given by the MD for Kharagpur production (Club & Run logic). " +
  "Decide from `rule`, which is the MD's own wording, and from `details`, which holds its exact condition and what to do when it fails. " +
  "list_rules also returns `rulesets`, whose `how_to_read` explains how to read `details`. `summary` is only a short note for finding a rule. " +
  "A rule is never edited: to change one, call save_rule with replaces_id, so the old wording is kept.";

class ToolError extends Error {}

const code = z.string().trim().min(1).max(40);
const summary = z.string().trim().min(1).max(2000);
const id = z.int().positive();

/** Today in the business time zone, as YYYY-MM-DD. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.TZ_BUSINESS ?? "Asia/Kolkata" }).format(new Date());

type Row = { id: number; code: string | null; topic: string; rule: string; summary: string | null; details: unknown; givenOn: Date; newRuleId: number | null };
const out = (r: Row) => ({
  id: r.id,
  code: r.code,
  topic: r.topic,
  rule: r.rule,
  summary: r.summary,
  details: r.details,
  given_on: r.givenOn.toISOString().slice(0, 10),
  status: r.newRuleId ? "replaced" : "in force",
  replaced_by: r.newRuleId,
});

function tool<S extends z.ZodType>(description: string, input: S, run: (args: z.infer<S>, db: Db) => Promise<unknown>) {
  return { description, input, run: (args: unknown, db: Db) => run(input.parse(args), db) };
}

export const TOOLS = {
  list_rules: tool(
    "List the MD's rules with their full text. Rules in force only, unless include_replaced is true.",
    z.object({
      code: code.optional().describe("Only the rule with this code, e.g. CR-B-04"),
      include_replaced: z.boolean().optional().describe("Also return old rules that a newer rule replaced"),
    }),
    async (a, db) => {
      const [rows, rulesets] = await Promise.all([
        db.mdRules.findMany({
          where: { ...(a.code ? { code: a.code } : {}), ...(a.include_replaced ? {} : { newRuleId: null }) },
          orderBy: [{ code: "asc" }, { id: "asc" }],
        }),
        // One header per rules file loaded by scripts/seed-rules.ts.
        db.setting.findMany({ where: { key: { startsWith: "ruleset:" } } }),
      ]);
      return { rulesets: rulesets.map((s) => s.value), rules: rows.map(out) };
    },
  ),
  save_rule: tool(
    "Save a new rule. To change an existing rule, pass its id as replaces_id: the old rule is kept and marked as replaced.",
    z.object({
      topic: z.string().trim().min(1).max(100).describe("Short title of the rule"),
      rule: z.string().trim().min(1).max(10000).describe("The MD's wording, as given"),
      code: code.optional().describe("The rule's own number, e.g. CR-B-04. A replacement keeps the old rule's code when this is left out"),
      summary: summary.optional().describe("Short plain summary of the rule"),
      details: z.record(z.string(), z.unknown()).optional().describe("Section, rule_type, condition, on_fail and the like, shaped as how_to_read in rulesets says"),
      given_on: z.iso.date().optional().describe("Date the MD gave the rule, YYYY-MM-DD. Default: today"),
      replaces_id: id.optional().describe("id of the rule in force that this one replaces"),
    }),
    (a, db) =>
      db.$transaction(async (tx) => {
        const old = a.replaces_id ? await tx.mdRules.findUnique({ where: { id: a.replaces_id }, select: { code: true } }) : null;
        const row = await tx.mdRules.create({
          data: {
            code: a.code ?? old?.code,
            topic: a.topic,
            rule: a.rule,
            summary: a.summary,
            details: a.details as Prisma.InputJsonObject | undefined,
            givenOn: new Date(a.given_on ?? today()),
          },
        });
        if (a.replaces_id) {
          // One statement checks and marks, so two replacements of the same rule cannot both win.
          const { count } = await tx.mdRules.updateMany({ where: { id: a.replaces_id, newRuleId: null }, data: { newRuleId: row.id } });
          if (count !== 1) throw new ToolError(`Rule ${a.replaces_id} does not exist or was already replaced. Nothing was saved.`);
        }
        return out(row);
      }),
  ),
  save_summary: tool(
    "Save or rewrite the summary of one rule. The rule text is not changed.",
    z.object({ id, summary }),
    async (a, db) => {
      const { count } = await db.mdRules.updateMany({ where: { id: a.id }, data: { summary: a.summary } });
      if (count !== 1) throw new ToolError(`No rule with id ${a.id}.`);
      return { id: a.id, summary: a.summary };
    },
  ),
};

const text = (s: string, isError = false) => ({ content: [{ type: "text", text: s }], ...(isError ? { isError } : {}) });

async function callTool(params: { name?: string; arguments?: unknown }, db: Db) {
  const t = TOOLS[params.name as keyof typeof TOOLS];
  if (!t) return null;
  try {
    return text(JSON.stringify(await t.run(params.arguments ?? {}, db)));
  } catch (e) {
    if (e instanceof z.ZodError) return text(z.prettifyError(e), true);
    if (e instanceof ToolError) return text(e.message, true);
    console.error("mcp tool failed", params.name, e);
    return text("The rule database could not be reached. Try again.", true);
  }
}

/** One JSON-RPC message in, its reply out. null when the message needs no reply (a notification). */
export async function handleRpc(msg: unknown, db: Db) {
  const m = (msg ?? {}) as { id?: string | number; method?: unknown; params?: Record<string, unknown> };
  const reply = (body: object): Record<string, unknown> => ({ jsonrpc: "2.0", id: m.id ?? null, ...body });
  const fail = (code: number, message: string) => reply({ error: { code, message } });

  if (typeof m.method !== "string") return fail(-32600, "Invalid request");
  if (m.id === undefined) return null;

  switch (m.method) {
    case "initialize": {
      const asked = String(m.params?.protocolVersion);
      return reply({
        result: {
          protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
          capabilities: { tools: {} },
          serverInfo: { name: "kgp-md-rules", version: "1.0.0" },
          instructions: INSTRUCTIONS,
        },
      });
    }
    case "ping":
      return reply({ result: {} });
    case "tools/list":
      return reply({
        result: {
          tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: z.toJSONSchema(t.input) })),
        },
      });
    case "tools/call": {
      const result = await callTool(m.params ?? {}, db);
      return result ? reply({ result }) : fail(-32602, `Unknown tool: ${String(m.params?.name)}`);
    }
    default:
      return fail(-32601, `Method not found: ${m.method}`);
  }
}
