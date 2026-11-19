import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../lib/generated/prisma/client.ts";
import { armouringPending, summariseOrders, waitingBetween, waitingForLaying } from "../../lib/dashboard/calc";
import { kgpLines, parityLines, PLANNED_CABLE } from "../fixtures/order-lines";

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

describe.skipIf(!url)("views match calc.ts", () => {
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
});
