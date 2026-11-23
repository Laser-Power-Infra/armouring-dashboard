import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../lib/generated/prisma/client.ts";
import { armouringPending, summariseOrders, waitingBetween, waitingForLaying } from "../fixtures/order-rules";
import { kgpLines, parityLines, PLANNED_CABLE } from "../fixtures/order-lines";
import { TABLES } from "../../lib/tables/defs";
import { defaultParams } from "../../lib/tables/params";
import { fetchFacet, fetchRows } from "../../lib/tables/query";
import { entryDays, hasOrders, pendingTotals, waitingTotals } from "../../lib/dashboard/totals";
import { sumKm } from "../../lib/dashboard/calc";

// Proof that the Postgres views give the same rows and km as the TypeScript rules.
// Needs a throwaway database: this file deletes rows.
try {
  process.loadEnvFile(".env");
} catch {}
const url = process.env.TEST_DATABASE_URL;
const same = (a?: string, b?: string) => !!a && !!b && new URL(a).host.replace("-pooler", "") === new URL(b).host.replace("-pooler", "") && new URL(a).pathname === new URL(b).pathname;
if (same(url, process.env.DATABASE_URL)) throw new Error("TEST_DATABASE_URL must not point at the app database: this test deletes rows");
if (!url) console.warn("SKIPPED tests/db/views.test.ts: set TEST_DATABASE_URL to a throwaway Postgres to prove view parity");

const CORE = new Set(["CONDUCTOR", "INSULATION"]);

describe.skipIf(!url)("database: views match calc.ts, tables page in SQL", () => {
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  const orders = summariseOrders(kgpLines);

  beforeAll(async () => {
    await db.orderLine.deleteMany();
    await db.lot.deleteMany();
    await db.planJob.deleteMany();
    await db.setting.upsert({ where: { key: "kgp_order_prefix" }, create: { key: "kgp_order_prefix", value: "P7" }, update: { value: "P7" } });
    await db.orderLine.createMany({ data: parityLines.map((l) => ({ ...l, qtyUnit: CORE.has(l.stage) ? "CORE_KM" : "CABLE_KM" })) });
    // Plans match by cable name, ignoring case and outer spaces. A completed lot does not count.
    await db.lot.create({ data: { lotNo: "L1", machineCode: "ARM5", cableItem: `  ${PLANNED_CABLE.toLowerCase()} `, bobbinsNeeded: 10 } });
    await db.productionEntry.deleteMany();
    await db.productionEntry.createMany({
      data: [
        { id: "e1", prodOrders: ["P7-1"], drumNo: "D-1", qtyM: 500, enteredBy: "ravi", shift: "DAY", enteredAt: new Date("2026-11-18T05:00:00Z") },
        { id: "e2", prodOrders: ["P7-1", "P7-2"], drumNo: "D-2", qtyM: 700, enteredBy: "ravi", shift: "NIGHT", enteredAt: new Date("2026-11-18T15:00:00Z") },
        { id: "e3", prodOrders: [], drumNo: "50%_off", qtyM: 300, enteredBy: null, shift: "DAY", enteredAt: new Date("2026-11-17T05:00:00Z"), isDuplicate: true },
        { id: "old", prodOrders: ["P7-9"], drumNo: "D-0", qtyM: 100, enteredBy: "ravi", shift: "DAY", enteredAt: new Date("2026-10-01T05:00:00Z") },
        { id: "other", prodOrders: ["P7-1"], drumNo: "D-9", qtyM: 100, enteredBy: "ravi", shift: "DAY", enteredAt: new Date("2026-11-18T05:00:00Z"), machineCode: "ARM4" },
      ].map((e) => ({ machineRaw: "ARMOURING NO- 5", machineCode: "ARM5", cable: "3.5C x 300", shiftDay: new Date(e.enteredAt.toISOString().slice(0, 10)), ...e })),
    });
    await db.lot.create({ data: { lotNo: "L2", machineCode: "ARM5", cableItem: "3.5C x 300", bobbinsNeeded: 10, completed: true } });
  }, 60_000);

  afterAll(() => db.$disconnect());

  it.each([
    ["insulation", () => waitingBetween(orders, "CONDUCTOR", "INSULATION")],
    ["laying", () => waitingForLaying(orders)],
    ["inner", () => waitingBetween(orders, "LAYING", "INNER_SHEATH")],
    ["armouring", () => waitingBetween(orders, "INNER_SHEATH", "ARMOURING")],
    ["outer", () => waitingBetween(orders, "ARMOURING", "OUTER_SHEATH")],
  ] as const)("order_waiting step %s", async (step, js) => {
    const got = await db.$queryRaw<{ prod_order: string; customer: string; cable: string; km: number }[]>`
      SELECT prod_order, customer, cable, km FROM order_waiting WHERE step = ${step} ORDER BY prod_order`;
    const want = js().sort((a, b) => a.prodOrder.localeCompare(b.prodOrder));
    expect(want.length).toBeGreaterThan(0);
    expect(got.map((r) => [r.prod_order, r.customer, r.cable])).toEqual(want.map((w) => [w.prodOrder, w.customer, w.cable]));
    got.forEach((r, i) => expect(r.km).toBeCloseTo(want[i].km, 3));
  });

  it("armouring_pending: rows, km, approved, in_plan", async () => {
    const got = await db.$queryRaw<{ prod_order: string; km: number; approved: boolean; in_plan: boolean }[]>`
      SELECT prod_order, km, approved, in_plan FROM armouring_pending ORDER BY prod_order`;
    const want = armouringPending(orders).sort((a, b) => a.prodOrder.localeCompare(b.prodOrder));
    expect(got.map((r) => [r.prod_order, r.approved, r.in_plan])).toEqual(want.map((w) => [w.prodOrder, w.approved, w.cable === PLANNED_CABLE]));
    got.forEach((r, i) => expect(r.km).toBeCloseTo(want[i].km, 3));
    expect(got.filter((r) => r.in_plan).map((r) => r.prod_order)).toEqual(["P7-7"]);
  });

  it("customer and cable are the first non-empty value by stage order then sfg_item", async () => {
    const got = await db.$queryRaw<{ prod_order: string; customer: string; cable: string }[]>`
      SELECT prod_order, customer, cable FROM order_summary WHERE prod_order IN ('P7-9', 'P7-6')  ORDER BY prod_order`;
    expect(got).toEqual([
      { prod_order: "P7-6", customer: "", cable: "" },
      { prod_order: "P7-9", customer: "ALPHA", cable: "3.5C x 300" },
    ]);
  });

  it("orders outside the Kharagpur prefix are not in any view", async () => {
    const [{ n }] = await db.$queryRaw<{ n: number }[]>`
      SELECT (SELECT count(*) FROM order_summary WHERE prod_order LIKE 'X9%')::int
           + (SELECT count(*) FROM order_waiting WHERE prod_order LIKE 'X9%')::int AS n`;
    expect(n).toBe(0);
  });

  // ── Table queries: paging, sorting, search and filter options run in the database ──
  const env = { client: db, since: new Date("2026-11-12T00:00:00Z") };
  const work = TABLES["work-left"];
  const wp = (over = {}) => ({ ...defaultParams(work, "ARM5"), ...over });

  it("rows: one page, biggest first, with the full total", async () => {
    const all = armouringPending(orders);
    const page = await fetchRows(work, wp({ size: 5 }), env);
    expect(page.total).toBe(all.length);
    expect(page.rows.map((r) => r.prodOrder)).toEqual(all.slice(0, 5).map((r) => r.prodOrder));
    expect(Object.keys(page.rows[0])).toEqual(["prodOrder", "customer", "cable", "km", "approved", "inPlan"]);
  });
  it("rows: page 2 continues where page 1 stopped; a page past the end is empty but keeps the total", async () => {
    const all = armouringPending(orders).map((r) => r.prodOrder);
    const p1 = await fetchRows(work, wp({ size: 5, sort: "prodOrder", dir: "asc" }), env);
    const far = await fetchRows(work, wp({ size: 5, sort: "prodOrder", dir: "asc", page: 9 }), env);
    expect(p1.rows.map((r) => r.prodOrder)).toEqual([...all].sort().slice(0, 5));
    expect(far).toEqual({ rows: [], total: all.length });
  });
  it("rows: search and filters narrow rows and total together", async () => {
    expect((await fetchRows(work, wp({ q: "planned" }), env)).rows.map((r) => r.prodOrder)).toEqual(["P7-7"]);
    expect((await fetchRows(work, wp({ filters: { approved: ["false"] } }), env)).rows.map((r) => r.prodOrder)).toEqual(["P7-6"]);
    expect((await fetchRows(work, wp({ filters: { customer: [""] } }), env)).rows.map((r) => r.prodOrder)).toEqual(["P7-6"]);
    expect((await fetchRows(work, wp({ filters: { inPlan: ["true"] }, q: "acme" }), env)).total).toBe(1);
  });
  it("facet: blank is always the first choice, and counts add up to the total", async () => {
    const { options, hasMore } = await fetchFacet(work, "customer", wp(), "", 0, env);
    expect(options).toEqual([
      { value: "", count: 1 },
      { value: "ACME", count: 2 },
    ]);
    expect(hasMore).toBe(false);
  });
  it("facet: counts follow the other filters and the search, but not the column's own filter", async () => {
    const own = await fetchFacet(work, "customer", wp({ filters: { customer: ["ACME"] } }), "", 0, env);
    expect(own.options).toHaveLength(2);
    const other = await fetchFacet(work, "customer", wp({ filters: { approved: ["true"] } }), "", 0, env);
    // Blank stays a choice even when no row is blank under the other filters: it shows 0.
    expect(other.options).toEqual([
      { value: "", count: 0 },
      { value: "ACME", count: 2 },
    ]);
    const bool = await fetchFacet(work, "approved", wp(), "", 0, env);
    expect(bool.options).toEqual([
      { value: "", count: 0 },
      { value: "true", count: 2 },
      { value: "false", count: 1 },
    ]);
  });
  it("facet: blank is offered once, on the first page of choices only", async () => {
    expect((await fetchFacet(work, "customer", wp(), "", 50, env)).options).toEqual([]);
    expect((await fetchRows(work, wp({ filters: { approved: [""] } }), env)).total).toBe(0);
  });
  it("facet: typing in the dropdown narrows its choices", async () => {
    expect((await fetchFacet(work, "customer", wp(), "ac", 0, env)).options).toEqual([{ value: "ACME", count: 2 }]);
  });

  const ent = TABLES.entries;
  const ep = (over = {}) => ({ ...defaultParams(ent, "ARM5"), ...over });
  it("entries: only this machine and the day window, newest first", async () => {
    const { rows, total } = await fetchRows(ent, ep(), env);
    expect(total).toBe(3);
    expect(rows.map((r) => r.drumNo)).toEqual(["D-2", "D-1", "50%_off"]);
    expect(rows[0]).toMatchObject({ shiftDay: "2026-11-18", prodOrders: "P7-1, P7-2", enteredAt: "2026-11-18T15:00:00.000Z", isDuplicate: false });
  });
  it("entries: an entry with two orders is found under either; one with none under blank", async () => {
    expect((await fetchRows(ent, ep({ filters: { prodOrders: ["P7-2"] } }), env)).rows.map((r) => r.drumNo)).toEqual(["D-2"]);
    expect((await fetchRows(ent, ep({ filters: { prodOrders: [""] } }), env)).rows.map((r) => r.drumNo)).toEqual(["50%_off"]);
    expect((await fetchFacet(ent, "prodOrders", ep(), "", 0, env)).options).toEqual([
      { value: "", count: 1 },
      { value: "P7-1", count: 2 },
      { value: "P7-2", count: 1 },
    ]);
  });
  it("entries: % and _ in a search are ordinary characters", async () => {
    expect((await fetchRows(ent, ep({ q: "50%_" }), env)).rows.map((r) => r.drumNo)).toEqual(["50%_off"]);
    expect((await fetchRows(ent, ep({ q: "%" }), env)).total).toBe(1);
  });
  it("entries: day and shift filters", async () => {
    expect((await fetchRows(ent, ep({ filters: { shiftDay: ["2026-11-18"], shift: ["NIGHT"] } }), env)).rows.map((r) => r.drumNo)).toEqual(["D-2"]);
  });

  it("lots: open lots of the chosen machine only", async () => {
    const lots = TABLES.lots;
    const { rows } = await fetchRows(lots, defaultParams(lots, "ARM5"), env);
    expect(rows).toEqual([expect.objectContaining({ lotNo: "L1", bobbinsNeeded: 10, bobbinsWound: 0, balance: 10, approved: false })]);
  });
  // ── Block totals come from the same views as the tables, so a tile cannot disagree with its list ──
  it("waiting totals: km and order count per step equal the rules' lists", async () => {
    const got = await waitingTotals(db);
    const want = {
      insulation: waitingBetween(orders, "CONDUCTOR", "INSULATION"),
      laying: waitingForLaying(orders),
      inner: waitingBetween(orders, "LAYING", "INNER_SHEATH"),
      armouring: waitingBetween(orders, "INNER_SHEATH", "ARMOURING"),
      outer: waitingBetween(orders, "ARMOURING", "OUTER_SHEATH"),
    };
    for (const [step, rows] of Object.entries(want)) {
      expect(got[step as keyof typeof got].count, step).toBe(rows.length);
      expect(got[step as keyof typeof got].km, step).toBeCloseTo(sumKm(rows), 3);
    }
  });
  it("pending totals: total, count, not in plan, not approved", async () => {
    const rows = armouringPending(orders);
    const got = await pendingTotals(db);
    expect(got.count).toBe(rows.length);
    expect(got.total).toBeCloseTo(sumKm(rows), 3);
    expect(got.notInPlan).toBeCloseTo(sumKm(rows.filter((r) => r.cable !== PLANNED_CABLE)), 3);
    expect(got.notApproved).toBeCloseTo(sumKm(rows.filter((r) => !r.approved)), 3);
    expect(got.plannedApproved).toBeCloseTo(sumKm(rows.filter((r) => r.cable === PLANNED_CABLE && r.approved)), 3);
    expect(got.plannedNotApproved).toBeCloseTo(sumKm(rows.filter((r) => r.cable === PLANNED_CABLE && !r.approved)), 3);
    expect(got.plannedApproved + got.plannedNotApproved + got.notInPlan).toBeCloseTo(got.total, 3);
  });
  it("hasOrders is true once Kharagpur lines are loaded", async () => {
    expect(await hasOrders(db)).toBe(true);
  });
  it("entry days: metres per shift day leave duplicates out, newest day first", async () => {
    expect(await entryDays(db, "ARM5", env.since)).toEqual([
      { day: "2026-11-18", metres: 1200, entries: 2, duplicates: 0 },
      { day: "2026-11-17", metres: 0, entries: 1, duplicates: 1 },
    ]);
  });
});
