import { defineConfig } from "prisma/config";

// The Prisma CLI does not read Next's env files; load them when present (absent on Vercel/CI).
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

// Migrations need Neon's direct connection: the pooled host minus "-pooler".
const directUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL?.replace("-pooler.", ".");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.ts",
  },
  // The app itself uses the pooled DATABASE_URL via lib/db.ts.
  datasource: { url: directUrl },
});
