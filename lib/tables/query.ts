import { Prisma } from "../generated/prisma/client.ts";
import { FILTER_KINDS, type TableDef, type TableScope } from "./defs.ts";
import { BLANK, type TableParams } from "./params.ts";

// Paging, sorting, search and filter options, all in Postgres: the browser only ever gets one page.
// Every request value is bound; identifiers come only from the table definition.

export type Row = Record<string, string | number | boolean | null>;
export type FacetOption = { value: string; count: number };
export type SqlClient = { $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T> };
export type QueryEnv = { client: SqlClient } & Pick<TableScope, "since">;

export const FACET_PAGE = 50;

/** A column of this table as a quoted identifier. Throws for anything the definition does not list. */
function ident(def: TableDef, key: string, suffix = ""): Prisma.Sql {
  const column = def.columns.find((c) => c.key === key);
  if (!column) throw new Error(`Unknown column for ${def.name}`);
  return Prisma.raw(`"${column.key}${suffix}"`);
}

/** %, _ and \ typed by the reader are ordinary characters, not wildcards. */
const contains = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

export function buildWhere(def: TableDef, p: TableParams, exceptColumn?: string): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (p.q) {
    const pattern = contains(p.q);
    const hits = def.columns.filter((c) => c.search).map((c) => Prisma.sql`(${ident(def, c.key)})::text ILIKE ${pattern} ESCAPE '\\'`);
    if (hits.length) conditions.push(Prisma.sql`(${Prisma.join(hits, " OR ")})`);
  }

  for (const [key, values] of Object.entries(p.filters)) {
    const column = def.columns.find((c) => c.key === key);
    if (!column || !FILTER_KINDS.includes(column.kind)) throw new Error(`Not a filter column for ${def.name}`);
    if (key === exceptColumn || values.length === 0) continue;
    if (column.array) {
      const arr = ident(def, key, "Arr");
      const any = Prisma.sql`${arr} && ${values.filter((v) => v !== BLANK)}::text[]`;
      conditions.push(values.includes(BLANK) ? Prisma.sql`(${any} OR cardinality(${arr}) = 0)` : any);
    } else {
      // NULL and '' are one choice: "(blank)".
      conditions.push(Prisma.sql`coalesce((${ident(def, key)})::text, '') IN (${Prisma.join(values)})`);
    }
  }

  return conditions.length ? Prisma.join(conditions, " AND ") : Prisma.sql`TRUE`;
}

export function buildOrderBy(def: TableDef, p: TableParams): Prisma.Sql {
  const first = p.sort ? Prisma.sql`${ident(def, p.sort)} ${Prisma.raw(p.dir === "asc" ? "ASC" : "DESC")} NULLS LAST` : def.defaultOrder;
  return Prisma.sql`${first}, ${def.tiebreak}`;
}

/** One page of rows and the total that match. */
export async function fetchRows(def: TableDef, p: TableParams, env: QueryEnv): Promise<{ rows: Row[]; total: number }> {
  const source = def.source({ machine: p.machine, since: env.since });
  const where = buildWhere(def, p);
  const columns = Prisma.join(def.columns.map((c) => ident(def, c.key)));
  const [rows, [{ n }]] = await Promise.all([
    env.client.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT ${columns} FROM ${source} WHERE ${where} ORDER BY ${buildOrderBy(def, p)} LIMIT ${p.size} OFFSET ${(p.page - 1) * p.size}`,
    ),
    env.client.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(*)::int AS n FROM ${source} WHERE ${where}`),
  ]);
  return {
    rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v as Row[string])]))),
    total: n,
  };
}

/**
 * The choices for one column's filter dropdown, with how many rows each would give.
 * Counted under the search and the other columns' filters, but not this column's own.
 * "(blank)" is always the first choice, with 0 beside it when no row is blank, so every filter offers it.
 */
export async function fetchFacet(
  def: TableDef,
  column: string,
  p: TableParams,
  oq: string,
  offset: number,
  env: QueryEnv,
): Promise<{ options: FacetOption[]; hasMore: boolean }> {
  const c = def.columns.find((x) => x.key === column);
  if (!c || !FILTER_KINDS.includes(c.kind)) throw new Error(`Not a filter column for ${def.name}`);
  const source = def.source({ machine: p.machine, since: env.since });
  const arr = ident(def, column, "Arr");
  const value = c.array
    ? Prisma.sql`unnest(CASE WHEN cardinality(${arr}) = 0 THEN ARRAY['']::text[] ELSE ${arr} END)`
    : Prisma.sql`coalesce((${ident(def, column)})::text, '')`;
  const values = Prisma.sql`(SELECT ${value} AS value FROM ${source} WHERE ${buildWhere(def, p, column)}) f`;
  const narrowed = oq ? Prisma.sql`AND value ILIKE ${contains(oq)} ESCAPE '\\'` : Prisma.empty;
  // Blank leads the first page of choices. It never matches a typed search.
  const leading = offset === 0 && !oq;
  const [found, blank] = await Promise.all([
    env.client.$queryRaw<FacetOption[]>(Prisma.sql`
      SELECT value, count(*)::int AS count FROM ${values}
      WHERE value <> '' ${narrowed}
      GROUP BY value ORDER BY count DESC, value ASC
      LIMIT ${FACET_PAGE + 1} OFFSET ${offset}`),
    leading ? env.client.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM ${values} WHERE value = ''`) : null,
  ]);
  const options = found.slice(0, FACET_PAGE);
  return { options: blank ? [{ value: BLANK, count: blank[0].count }, ...options] : options, hasMore: found.length > FACET_PAGE };
}
