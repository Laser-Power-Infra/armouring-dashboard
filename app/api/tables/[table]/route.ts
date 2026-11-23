import type { NextRequest } from "next/server";
import { getTableEnv } from "@/lib/dashboard/data";
import { handleRows } from "@/lib/tables/handlers";
import { fetchFacet, fetchRows } from "@/lib/tables/query";

/** One page of a dashboard table: paged, sorted, searched and filtered in the database. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/tables/[table]">) {
  const { table } = await ctx.params;
  return handleRows(table, req.nextUrl.searchParams, { env: getTableEnv, fetchRows, fetchFacet });
}
