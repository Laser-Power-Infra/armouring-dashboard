import { describe, expect, it, vi } from "vitest";
import { handleFacets, handleRows, type TableDeps } from "../../lib/tables/handlers";

const since = new Date("2026-11-12T00:00:00Z");
const deps = (over: Partial<TableDeps> = {}) => {
  const d = {
    env: vi.fn(async () => ({ client: { $queryRaw: vi.fn() }, since })),
    fetchRows: vi.fn(async () => ({ rows: [{ prodOrder: "P7-1", km: 8 }], total: 37 })),
    fetchFacet: vi.fn(async () => ({ options: [{ value: "ACME", count: 2 }], hasMore: false })),
    ...over,
  };
  return d as typeof d & TableDeps;
};
const sp = (qs: string) => new URLSearchParams(qs);

describe("GET /api/tables/:table", () => {
  it("unknown table is 404 and nothing is queried", async () => {
    const d = deps();
    const res = await handleRows("users", sp("machine=ARM5"), d);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Unknown table" });
    expect(d.fetchRows).not.toHaveBeenCalled();
    expect(d.env).not.toHaveBeenCalled();
  });
  it.each(["size=1000", "sort=password", "page=abc", "f.km=1"])("%s is 400 and nothing is queried", async (bad) => {
    const d = deps();
    const res = await handleRows("work-left", sp("machine=ARM5&" + bad), d);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Bad request" });
    expect(d.fetchRows).not.toHaveBeenCalled();
  });
  it("a valid request returns the page and the total, uncached", async () => {
    const d = deps();
    const res = await handleRows("work-left", sp("machine=ARM5&page=2&size=25&f.customer=ACME"), d);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ rows: [{ prodOrder: "P7-1", km: 8 }], total: 37 });
    expect(d.fetchRows.mock.calls[0][1]).toMatchObject({ machine: "ARM5", page: 2, size: 25, filters: { customer: ["ACME"] } });
  });
  it("a failed query is 500 and its message does not leave the server", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleRows("work-left", sp("machine=ARM5"), deps({ fetchRows: vi.fn(async () => Promise.reject(new Error("password=hunter2 at 10.0.0.5"))) }));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"Could not load"}');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("GET /api/tables/:table/facets", () => {
  it("returns the choices for a filter column", async () => {
    const d = deps();
    const res = await handleFacets("work-left", sp("machine=ARM5&column=customer&oq=ac&offset=50&q=tata"), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ options: [{ value: "ACME", count: 2 }], hasMore: false });
    const [, column, params, oq, offset] = d.fetchFacet.mock.calls[0];
    expect([column, params.q, oq, offset]).toEqual(["customer", "tata", "ac", 50]);
  });
  it.each(["column=km", "column=password", "", "column=customer&offset=-1", "column=customer&offset=x", "column=customer&oq=" + "x".repeat(201)])(
    "'%s' is 400 and nothing is queried",
    async (bad) => {
      const d = deps();
      const res = await handleFacets("work-left", sp("machine=ARM5&" + bad), d);
      expect(res.status).toBe(400);
      expect(d.fetchFacet).not.toHaveBeenCalled();
    },
  );
  it("unknown table is 404", async () => {
    expect((await handleFacets("nope", sp("machine=ARM5&column=customer"), deps())).status).toBe(404);
  });
});
