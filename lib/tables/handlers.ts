import { z, ZodError } from "zod";
import { FILTER_KINDS, isTableName, TABLES } from "./defs.ts";
import { parseTableParams, requestText } from "./params.ts";
import type { fetchFacet, fetchRows, QueryEnv } from "./query.ts";

// The request handlers behind /api/tables, kept free of Next so they run in plain tests.
// The dashboard is readable without login, and these return only what it already shows.

export type TableDeps = { env: () => Promise<QueryEnv>; fetchRows: typeof fetchRows; fetchFacet: typeof fetchFacet };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function guarded(table: string, run: (def: (typeof TABLES)[keyof typeof TABLES]) => Promise<unknown>): Promise<Response> {
  if (!isTableName(table)) return json({ error: "Unknown table" }, 404);
  try {
    return json(await run(TABLES[table]));
  } catch (e) {
    if (e instanceof ZodError) return json({ error: "Bad request" }, 400);
    // The cause stays in the server log; the browser gets a message it can show.
    console.error(`[tables] ${table}`, e);
    return json({ error: "Could not load" }, 500);
  }
}

/** One page of a table. */
export function handleRows(table: string, sp: URLSearchParams, deps: TableDeps): Promise<Response> {
  return guarded(table, async (def) => {
    const params = parseTableParams(def, sp);
    return deps.fetchRows(def, params, await deps.env());
  });
}

/** The choices for one column's filter dropdown. */
export function handleFacets(table: string, sp: URLSearchParams, deps: TableDeps): Promise<Response> {
  return guarded(table, async (def) => {
    const params = parseTableParams(def, sp);
    const filterable = def.columns.filter((c) => FILTER_KINDS.includes(c.kind)).map((c) => c.key);
    const { column, oq, offset } = z
      .object({
        column: z.string().refine((c) => filterable.includes(c)),
        oq: requestText.transform((s) => s.trim()).default(""),
        offset: z.coerce.number().int().min(0).max(100_000).default(0),
      })
      .parse(Object.fromEntries(["column", "oq", "offset"].flatMap((k) => (sp.has(k) ? [[k, sp.get(k)]] : []))));
    return deps.fetchFacet(def, column, params, oq, offset, await deps.env());
  });
}
