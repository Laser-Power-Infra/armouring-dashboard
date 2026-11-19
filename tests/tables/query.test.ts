import { describe, expect, it } from "vitest";
import { TABLES } from "../../lib/tables/defs";
import { defaultParams, type TableParams } from "../../lib/tables/params";
import { buildOrderBy, buildWhere } from "../../lib/tables/query";

// The builders return Prisma.Sql: `.sql` is the statement with ? placeholders, `.values` what is bound.
const def = TABLES["work-left"];
const p = (over: Partial<TableParams>): TableParams => ({ ...defaultParams(def, "ARM5"), ...over });

describe("where", () => {
  it("no search and no filters: no conditions, nothing bound", () => {
    expect(buildWhere(def, p({})).values).toEqual([]);
  });
  it("search is bound, and % _ \\ in it are matched literally", () => {
    const w = buildWhere(def, p({ q: "50%_o'k\\" }));
    expect(w.values).toContain("%50\\%\\_o'k\\\\%");
    expect(w.sql).not.toContain("50%");
    expect(w.sql).toMatch(/ILIKE \? ESCAPE '\\'/);
  });
  it("search covers only the search columns", () => {
    expect(buildWhere(def, p({ q: "x" })).values).toEqual(["%x%", "%x%", "%x%"]);
  });
  it("filter values are bound, never written into the statement", () => {
    const w = buildWhere(def, p({ filters: { customer: ["A'; DROP TABLE users;--"] } }));
    expect(w.sql).not.toContain("DROP");
    expect(w.values).toContain("A'; DROP TABLE users;--");
  });
  it("blank filter value matches rows with no value", () => {
    const w = buildWhere(def, p({ filters: { customer: [""] } }));
    expect(w.sql).toMatch(/coalesce\(\("customer"\)::text, ''\) IN \(\?\)/);
    expect(w.values).toEqual([""]);
  });
  it("an empty filter list adds no condition", () => {
    expect(buildWhere(def, p({ filters: { customer: [] } })).values).toEqual([]);
  });
  it("exceptColumn drops that column's own filter, so its dropdown still lists the other choices", () => {
    expect(buildWhere(def, p({ filters: { customer: ["A"], cable: ["B"] } }), "customer").values).toEqual(["B"]);
  });
  it("a column holding several values matches when any of them is chosen", () => {
    const e = TABLES.entries;
    const w = buildWhere(e, { ...defaultParams(e, "ARM5"), filters: { prodOrders: ["P7-1", "P7-2"] } });
    expect(w.sql).toContain('"prodOrdersArr" &&');
    expect(w.values).toEqual([["P7-1", "P7-2"]]);
  });
  it("a column name from the request is never used unless the table defines it", () => {
    expect(() => buildWhere(def, p({ filters: { 'x"; DROP': ["1"] } }))).toThrow();
  });
});

describe("order by", () => {
  it("default is biggest first, then the tiebreak", () => {
    expect(buildOrderBy(def, p({})).sql).toBe('"km" DESC, "prodOrder" ASC');
  });
  it("chosen column and direction, nulls last, then the tiebreak", () => {
    expect(buildOrderBy(def, p({ sort: "customer", dir: "asc" })).sql).toBe('"customer" ASC NULLS LAST, "prodOrder" ASC');
  });
  it("an unknown sort column throws instead of reaching SQL", () => {
    expect(() => buildOrderBy(def, p({ sort: "password" }))).toThrow();
  });
});
