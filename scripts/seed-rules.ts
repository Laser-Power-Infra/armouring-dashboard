// Loads one file of MD rules into md_rules: node scripts/seed-rules.ts prisma/data/<file>.json
// Safe to re-run: a rule is added only when its code was never loaded, so a rule changed later is not overwritten.
// shortcut: a new version of a file does not change rules already loaded; replace those through the MCP save_rule tool.
import { readFileSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { type Prisma, PrismaClient } from "../lib/generated/prisma/client.ts";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}

const file = process.argv[2];
if (!file || !process.env.DATABASE_URL) {
  console.error("Usage: node scripts/seed-rules.ts prisma/data/<file>.json   (needs DATABASE_URL in .env)");
  process.exit(1);
}

type RuleIn = { rule_id: string; title: string; rule_text: string; source_date: string; [rest: string]: unknown };
const { rules, ...header } = JSON.parse(readFileSync(file, "utf8")) as { ruleset: string; rule_count: number; rules: RuleIn[] };

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
try {
  if (!header.ruleset || rules.length !== header.rule_count) throw new Error(`${file}: needs a "ruleset" name, and rule_count (${header.rule_count}) must match its ${rules.length} rules`);
  const bad = rules.find((r) => !r.rule_id || !r.title || !r.rule_text || Number.isNaN(Date.parse(r.source_date)));
  if (bad) throw new Error(`${file}: rule ${bad.rule_id ?? "(no rule_id)"} needs rule_id, title, rule_text and source_date`);

  // The file's header (scope, how to read a condition) is one setting per ruleset; the MCP list_rules tool returns it.
  const key = `ruleset:${header.ruleset}`;
  const value = header as Prisma.InputJsonObject;
  await db.setting.upsert({ where: { key }, create: { key, value, description: `MD rules header, from ${file}`, updatedBy: "seed-rules" }, update: { value, updatedBy: "seed-rules" } });

  const have = new Set((await db.mdRules.findMany({ where: { code: { not: null } }, select: { code: true } })).map((r) => r.code));
  const fresh = rules.filter((r) => !have.has(r.rule_id));
  await db.mdRules.createMany({
    data: fresh.map(({ rule_id, title, rule_text, source_date, ...details }) => ({
      code: rule_id,
      topic: title,
      rule: rule_text,
      givenOn: new Date(source_date),
      details: details as Prisma.InputJsonObject,
    })),
  });
  console.log(`${header.ruleset}: ${fresh.length} of ${rules.length} rules added, ${rules.length - fresh.length} already there.`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
