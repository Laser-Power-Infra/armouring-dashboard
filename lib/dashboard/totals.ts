import { Prisma } from "../generated/prisma/client.ts";
import type { SqlClient } from "../tables/query.ts";

// Block totals, summed in the database from the same views the tables page through,
// so a tile and its table always agree. The rules themselves live in the views
// (prisma/migrations/20261119000000_order_views).

export const STEP_KEYS = ["insulation", "laying", "inner", "armouring", "outer"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

/** km waiting in front of each step, and in how many orders. A step with nothing waiting is 0, 0. */
export async function waitingTotals(client: SqlClient): Promise<Record<StepKey, { km: number; count: number }>> {
  const rows = await client.$queryRaw<{ step: StepKey; km: number; count: number }[]>(
    Prisma.sql`SELECT step, sum(km)::float8 AS km, count(*)::int AS count FROM order_waiting GROUP BY step`,
  );
  const totals = Object.fromEntries(STEP_KEYS.map((k) => [k, { km: 0, count: 0 }])) as Record<StepKey, { km: number; count: number }>;
  for (const r of rows) totals[r.step] = { km: r.km, count: r.count };
  return totals;
}

export type PendingTotals = { total: number; count: number; notInPlan: number; notApproved: number; plannedApproved: number; plannedNotApproved: number };

/** Armouring still to do across Kharagpur, with the parts not yet in any plan and not yet approved. */
export async function pendingTotals(client: SqlClient): Promise<PendingTotals> {
  const [r] = await client.$queryRaw<PendingTotals[]>(Prisma.sql`
    SELECT coalesce(sum(km), 0)::float8 AS total,
           count(*)::int AS count,
           coalesce(sum(km) FILTER (WHERE NOT in_plan), 0)::float8 AS "notInPlan",
           coalesce(sum(km) FILTER (WHERE NOT approved), 0)::float8 AS "notApproved",
           coalesce(sum(km) FILTER (WHERE in_plan AND approved), 0)::float8 AS "plannedApproved",
           coalesce(sum(km) FILTER (WHERE in_plan AND NOT approved), 0)::float8 AS "plannedNotApproved"
    FROM armouring_pending`);
  return r;
}

/** Whether any Kharagpur order line has been loaded. */
export async function hasOrders(client: SqlClient): Promise<boolean> {
  const [r] = await client.$queryRaw<{ any: boolean }[]>(Prisma.sql`SELECT EXISTS (SELECT 1 FROM order_summary) AS "any"`);
  return r.any;
}

/** Per shift day for one machine, newest first. Duplicate drums are counted but their metres are never added (md §7.1). */
export async function entryDays(client: SqlClient, machineCode: string, since: Date): Promise<{ day: string; metres: number; entries: number; duplicates: number }[]> {
  return client.$queryRaw(Prisma.sql`
    SELECT to_char(shift_day, 'YYYY-MM-DD') AS day,
           coalesce(sum(qty_m) FILTER (WHERE NOT is_duplicate), 0)::float8 AS metres,
           count(*)::int AS entries,
           (count(*) FILTER (WHERE is_duplicate))::int AS duplicates
    FROM production_entries
    WHERE machine_code = ${machineCode} AND shift_day >= ${since}
    GROUP BY shift_day ORDER BY shift_day DESC`);
}
