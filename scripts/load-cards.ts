// Stores the card issue now in the data sheet: node scripts/load-cards.ts --db=test|app
// Older issues are kept. The same version loaded again replaces only itself.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { loadCards, readCardTabs } from "../lib/cards/load.ts";

try {
  process.loadEnvFile(".env");
} catch {}

const target = process.argv.find((a) => a.startsWith("--db="))?.slice(5);
const url = target === "test" ? process.env.TEST_DATABASE_URL : target === "app" ? process.env.DATABASE_URL : undefined;
const sheet = process.env.CARDS_SHEET_ID;
if (!url || !sheet) {
  console.error("Usage: node scripts/load-cards.ts --db=test|app   (needs CARDS_SHEET_ID and the database URL in .env)");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
try {
  const r = await loadCards(db, await readCardTabs(sheet));
  console.log(`Stored issue ${r.issueDate} / Rev ${r.rev} ("${r.version}") in the ${target} database`);
  console.table(r.rows);
} finally {
  await db.$disconnect();
}
