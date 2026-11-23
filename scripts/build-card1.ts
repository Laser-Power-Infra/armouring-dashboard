// Builds the four cards from the source sheets and stores it as a new issue: node scripts/build-card1.ts --db=test|app
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { buildCards } from "../lib/cards/load.ts";

try {
  process.loadEnvFile(".env");
} catch {}

const target = process.argv.find((a) => a.startsWith("--db="))?.slice(5);
const url = target === "test" ? process.env.TEST_DATABASE_URL : target === "app" ? process.env.DATABASE_URL : undefined;
if (!url) {
  console.error("Usage: node scripts/build-card1.ts --db=test|app   (needs the database URL and the Google service account in .env)");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
try {
  const r = await buildCards(db);
  console.log(`Stored card issue ${r.version} (day 0 = ${r.d0}, ${r.jobLines} job lines) in the ${target} database`);
  for (const p of [r.labourProblem && `Card 2 not built: ${r.labourProblem}`, r.drumProblem && `Cards 3 and 4 not built: ${r.drumProblem}`]) if (p) console.log(p);
  if (r.notPlanned.length) console.log(`Not planned – to confirm:\n  ${r.notPlanned.join("\n  ")}`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
