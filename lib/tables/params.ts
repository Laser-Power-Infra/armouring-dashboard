import { z } from "zod";
import { FILTER_KINDS, type TableDef } from "./defs.ts";

export type TableParams = {
  machine: string;
  page: number;
  size: number;
  /** null = the table's own default order */
  sort: string | null;
  dir: "asc" | "desc";
  q: string;
  /** column key -> chosen values; "" means rows with no value */
  filters: Record<string, string[]>;
};

export const PAGE_SIZES = [5, 10, 25, 50] as const;
/** Filter value for "no value" (NULL or empty); the table labels it "(blank)". */
export const BLANK = "";
const FILTER_PREFIX = "f.";

export const defaultParams = (def: TableDef, machine: string): TableParams => ({
  machine,
  page: 1,
  size: def.defaultSize,
  sort: null,
  dir: "desc",
  q: "",
  filters: {},
});

/** Request params for one table. Throws a ZodError on anything outside the table's whitelist. */
export function parseTableParams(def: TableDef, sp: URLSearchParams): TableParams {
  const keys = def.columns.map((c) => c.key);
  const scalar = z
    .object({
      machine: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
      page: z.coerce.number().int().min(1).max(100_000).default(1),
      size: z.coerce
        .number()
        .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
        .default(def.defaultSize),
      sort: z
        .string()
        .refine((s) => keys.includes(s))
        .nullable()
        .default(null),
      dir: z.enum(["asc", "desc"]).default("desc"),
      q: z.string().trim().max(200).default(""),
    })
    .parse(Object.fromEntries(["machine", "page", "size", "sort", "dir", "q"].flatMap((k) => (sp.has(k) ? [[k, sp.get(k)]] : []))));

  const filters: Record<string, string[]> = {};
  for (const name of new Set(sp.keys())) {
    if (!name.startsWith(FILTER_PREFIX)) continue;
    const column = def.columns.find((c) => c.key === name.slice(FILTER_PREFIX.length));
    const values = z.array(z.string().max(200)).max(200).parse(sp.getAll(name));
    if (!column || !FILTER_KINDS.includes(column.kind)) throw new z.ZodError([{ code: "custom", message: "Not a filter column", path: [name], input: name }]);
    if (column.kind === "bool" && values.some((v) => v !== "true" && v !== "false")) throw new z.ZodError([{ code: "custom", message: "Yes/no filter", path: [name], input: values }]);
    filters[column.key] = values;
  }
  return { ...scalar, machine: scalar.machine.toUpperCase(), filters };
}
