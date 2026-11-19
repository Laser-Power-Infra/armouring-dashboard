import type { NextRequest } from "next/server";
import { getTableEnv } from "@/lib/dashboard/data";
import { handleFacets } from "@/lib/tables/handlers";
import { fetchFacet, fetchRows } from "@/lib/tables/query";

/** The choices for one column's filter dropdown, with counts. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/tables/[table]/facets">) {
  const { table } = await ctx.params;
  return handleFacets(table, req.nextUrl.searchParams, { env: getTableEnv, fetchRows, fetchFacet });
}
