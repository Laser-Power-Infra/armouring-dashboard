import { readFileSync } from "node:fs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../lib/generated/prisma/client.ts";
import type { CardTabs } from "../../lib/cards/load";

// Card tests that touch a database need a throwaway one: they delete rows.
try {
  process.loadEnvFile(".env");
} catch {}
export const url = process.env.TEST_DATABASE_URL;
const same = (a?: string, b?: string) => !!a && !!b && new URL(a).host.replace("-pooler", "") === new URL(b).host.replace("-pooler", "") && new URL(a).pathname === new URL(b).pathname;
if (same(url, process.env.DATABASE_URL)) throw new Error("TEST_DATABASE_URL must not point at the app database: these tests delete rows");
if (!url) console.warn("SKIPPED card database tests: set TEST_DATABASE_URL to a throwaway Postgres");

export const testDb = () => new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

/** The six tabs as read from the sheet on 19-Nov-26 (version "17-Nov R2 plan"). */
export const fixture = (name: string): unknown[][] => JSON.parse(readFileSync(`tests/fixtures/cards/${name}.json`, "utf8"));

export const fixtureTabs = (): CardTabs => ({
  plan: fixture("card-plan"),
  labour: fixture("labour-allocation"),
  spare: fixture("spare-men"),
  need: fixture("fg-drum-need"),
  assembly: fixture("drum-assembly"),
  stock: fixture("drum-stock"),
});

/** The same tabs under another version text. Column A is Version in every card tab. */
export function withVersion(tabs: CardTabs, version: string): CardTabs {
  const set = (grid: unknown[][]) => grid.map((r, i) => (i === 0 ? r : [version, ...r.slice(1)]));
  return { ...tabs, plan: set(tabs.plan), labour: set(tabs.labour), spare: set(tabs.spare), need: set(tabs.need), assembly: set(tabs.assembly) };
}
