import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client.ts";

// One client per server process; reused across dev hot reloads. After `prisma generate` the client class is new, so
// an instance of the old class (which does not know the new columns) is replaced instead of reused.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const cached = globalForPrisma.prisma instanceof PrismaClient ? globalForPrisma.prisma : undefined;

export const db = cached ?? new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
