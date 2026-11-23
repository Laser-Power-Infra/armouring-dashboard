import { z } from "zod";
import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";

// The MCP server: MD sir's rules (read and write) and the synced data (read only). JSON-RPC over one POST, no session, no streaming.
// shortcut: hand-written tools; move to @modelcontextprotocol/sdk when resources, prompts or streaming are needed.

/** Read-only data: MCP name -> Prisma model, what it holds, its columns. Users, settings and secrets are never listed. */
const DATA = {
  club_lots: { model: "kgpLot", about: "Club & Run sheet, Lots tab: each clubbed lot, run order, MD approval, balances", fields: Prisma.KgpLotScalarFieldEnum },
  club_orders: { model: "kgpOrder", about: "Club & Run sheet, Orders tab: each order, its lot, stage balances, remarks", fields: Prisma.KgpOrderScalarFieldEnum },
  sfg_order_lines: { model: "kgpOrderLine", about: "SFG dashboard: each order's semi-finished lines per stage, with net, done and balance qty", fields: Prisma.KgpOrderLineScalarFieldEnum },
  bom_lines: { model: "bomLine", about: "SFG dashboard: material per item (kg per km) for each SFG BOM", fields: Prisma.BomLineScalarFieldEnum },
  rm_stock: { model: "rmStock", about: "RM Control: raw material quantity for planning", fields: Prisma.RmStockScalarFieldEnum },
  machine_men: { model: "machineMen", about: "Machines to Run Daily: men per shift and must-run machines", fields: Prisma.MachineMenScalarFieldEnum },
  sync_runs: { model: "syncRun", about: "Log of each sheet read by the sync: source, tab, time, rows, ok", fields: Prisma.SyncRunScalarFieldEnum },
  card_issues: { model: "cardIssue", about: "Each stored version of the four KGP cards", fields: Prisma.CardIssueScalarFieldEnum },
  card_plan: { model: "cardPlan", about: "Card 1 production plan rows, per card issue", fields: Prisma.CardPlanScalarFieldEnum },
  card_labour: { model: "cardLabour", about: "Card 2 labour allocation rows, per card issue", fields: Prisma.CardLabourScalarFieldEnum },
  card_spare_men: { model: "cardSpareMen", about: "Card 2 spare men rows, per card issue", fields: Prisma.CardSpareMenScalarFieldEnum },
  card_drum_need: { model: "cardDrumNeed", about: "Card 3 finished goods drum requirement rows, per card issue", fields: Prisma.CardDrumNeedScalarFieldEnum },
  card_drum_assembly: { model: "cardDrumAssembly", about: "Card 4 drum assembly rows, per card issue", fields: Prisma.CardDrumAssemblyScalarFieldEnum },
  card_drum_stock: { model: "cardDrumStock", about: "Card 4 drum stock by size, per card issue", fields: Prisma.CardDrumStockScalarFieldEnum },
} as const;
type DataName = keyof typeof DATA;

type Db = Pick<PrismaClient, "mdRules" | "setting" | "$transaction" | (typeof DATA)[DataName]["model"]>;
type Reader = { findMany: (a: object) => Promise<unknown[]>; count: (a: object) => Promise<number> };

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "Rules given by the MD for Kharagpur production (Club & Run logic). " +
  "Decide from `rule`, which is the MD's own wording, and from `details`, which holds its exact condition and what to do when it fails. " +
  "list_rules also returns `rulesets`, whose `how_to_read` explains how to read `details`. `summary` is only a short note for finding a rule. " +
  "A rule is never edited in place: update_rule stores the new wording and keeps the old one as replaced; delete_rule only marks a rule deleted. " +
  "The synced data (Club & Run, SFG, stock, cards) is read only: list_data names the tables and their columns, read_data reads rows.";

class ToolError extends Error {}

const code = z.string().trim().min(1).max(40);
const summary = z.string().trim().min(1).max(2000);
const id = z.int().positive();

/** Today in the business time zone, as YYYY-MM-DD. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.TZ_BUSINESS ?? "Asia/Kolkata" }).format(new Date());

type Row = { id: number; code: string | null; topic: string; rule: string; summary: string | null; details: unknown; givenOn: Date; newRuleId: number | null; deletedAt: Date | null };
const out = (r: Row) => ({
  id: r.id,
  code: r.code,
  topic: r.topic,
  rule: r.rule,
  summary: r.summary,
  details: r.details,
  given_on: r.givenOn.toISOString().slice(0, 10),
  status: r.deletedAt ? "deleted" : r.newRuleId ? "replaced" : "in force",
  replaced_by: r.newRuleId,
});

function tool<S extends z.ZodType>(description: string, input: S, run: (args: z.infer<S>, db: Db) => Promise<unknown>) {
  return { description, input, run: (args: unknown, db: Db) => run(input.parse(args), db) };
}

/** In force: neither replaced nor deleted. */
const inForce = { newRuleId: null, deletedAt: null };

const topic = z.string().trim().min(1).max(100).describe("Short title of the rule");
const ruleText = z.string().trim().min(1).max(10000).describe("The MD's wording, as given");
const details = z.record(z.string(), z.unknown()).describe("Section, rule_type, condition, on_fail and the like, shaped as how_to_read in rulesets says");
const givenOn = z.iso.date().describe("Date the MD gave the rule, YYYY-MM-DD. Default: today");

export const TOOLS = {
  list_rules: tool(
    "List the MD's rules with their full text. Rules in force only, unless include_replaced or include_deleted is true.",
    z.object({
      code: code.optional().describe("Only the rule with this code, e.g. CR-B-04"),
      include_replaced: z.boolean().optional().describe("Also return old rules that a newer rule replaced"),
      include_deleted: z.boolean().optional().describe("Also return rules marked deleted"),
    }),
    async (a, db) => {
      const [rows, rulesets] = await Promise.all([
        db.mdRules.findMany({
          where: { ...(a.code ? { code: a.code } : {}), ...(a.include_replaced ? {} : { newRuleId: null }), ...(a.include_deleted ? {} : { deletedAt: null }) },
          orderBy: [{ code: "asc" }, { id: "asc" }],
        }),
        // One header per rules file loaded by scripts/seed-rules.ts.
        db.setting.findMany({ where: { key: { startsWith: "ruleset:" } } }),
      ]);
      return { rulesets: rulesets.map((s) => s.value), rules: rows.map(out) };
    },
  ),
  create_rule: tool(
    "Add a new rule given by the MD.",
    z.object({ topic, rule: ruleText, code: code.optional().describe("The rule's own number, e.g. CR-B-04"), summary: summary.optional(), details: details.optional(), given_on: givenOn.optional() }),
    async (a, db) =>
      out(
        await db.mdRules.create({
          data: { code: a.code, topic: a.topic, rule: a.rule, summary: a.summary, details: a.details as Prisma.InputJsonObject | undefined, givenOn: new Date(a.given_on ?? today()) },
        }),
      ),
  ),
  update_rule: tool(
    "Change a rule in force. The new version is stored as a new rule and the old one is kept, marked replaced. Fields left out are copied from the old rule.",
    z.object({
      id: id.describe("id of the rule in force to change"),
      topic: topic.optional(),
      rule: ruleText.optional(),
      code: code.optional().describe("The rule's own number. Default: the old rule's"),
      summary: summary.optional(),
      details: details.optional(),
      given_on: givenOn.optional(),
    }),
    (a, db) =>
      db.$transaction(async (tx) => {
        const old = await tx.mdRules.findFirst({ where: { id: a.id, ...inForce } });
        if (!old) throw new ToolError(`Rule ${a.id} does not exist, or was already replaced or deleted. Nothing was saved.`);
        const row = await tx.mdRules.create({
          data: {
            code: a.code ?? old.code,
            topic: a.topic ?? old.topic,
            rule: a.rule ?? old.rule,
            summary: a.summary ?? old.summary,
            details: (a.details ?? old.details ?? undefined) as Prisma.InputJsonObject | undefined,
            givenOn: new Date(a.given_on ?? today()),
          },
        });
        // One statement checks and marks, so two changes of the same rule cannot both win.
        const { count } = await tx.mdRules.updateMany({ where: { id: a.id, ...inForce }, data: { newRuleId: row.id } });
        if (count !== 1) throw new ToolError(`Rule ${a.id} was changed or deleted at the same time. Nothing was saved.`);
        return out(row);
      }),
  ),
  delete_rule: tool(
    "Delete a rule in force. Nothing is removed: the rule is kept with its wording, marked deleted, and is no longer in force.",
    z.object({ id: id.describe("id of the rule in force to delete") }),
    async (a, db) => {
      const { count } = await db.mdRules.updateMany({ where: { id: a.id, ...inForce }, data: { deletedAt: new Date() } });
      if (count !== 1) throw new ToolError(`Rule ${a.id} does not exist, or was already replaced or deleted.`);
      return { id: a.id, status: "deleted" };
    },
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
  list_data: tool("List the read-only data tables: what each holds and its columns.", z.object({}), async () =>
    Object.entries(DATA).map(([table, d]) => ({ table, about: d.about, columns: Object.keys(d.fields) })),
  ),
  read_data: tool(
    "Read rows of one data table (read only). Filter by exact column values; page with limit and offset. Returns the matching rows and how many match in all.",
    z.object({
      table: z.enum(Object.keys(DATA) as [DataName, ...DataName[]]).describe("A table from list_data"),
      where: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe("Column -> exact value. Dates as ISO time, e.g. 2026-11-23T00:00:00.000Z"),
      order_by: z.string().optional().describe("Column to sort by"),
      desc: z.boolean().optional().describe("Sort descending"),
      limit: z.int().min(1).max(1000).default(100),
      offset: z.int().min(0).default(0),
    }),
    async (a, db) => {
      const d = DATA[a.table];
      const cols = Object.keys(d.fields);
      // Only known columns reach Prisma: values are plain scalars, so no filter operator can be passed in.
      const bad = [...Object.keys(a.where ?? {}), ...(a.order_by ? [a.order_by] : [])].filter((c) => !cols.includes(c));
      if (bad.length) throw new ToolError(`${a.table} has no column ${bad.join(", ")}. Columns: ${cols.join(", ")}`);
      const t = db[d.model] as unknown as Reader;
      const where = a.where ?? {};
      const [rows, total] = await Promise.all([
        t.findMany({ where, ...(a.order_by ? { orderBy: { [a.order_by]: a.desc ? "desc" : "asc" } } : {}), take: a.limit, skip: a.offset }),
        t.count({ where }),
      ]);
      return { table: a.table, total, offset: a.offset, rows };
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
    return text("The database could not be reached, or a value did not fit its column. Try again.", true);
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
