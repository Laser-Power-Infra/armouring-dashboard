import { describe, expect, it } from "vitest";
import { expectedDates, failed, lateness, lotChecks, lotViews, newLotDate, profileOf, suggestLots, trafficJam, type LineIn, type LotIn, type OrderIn, type PlanIn } from "../../lib/club/insight";

const ln = (prodOrder: string, stage: string, sfgItem: string, netQty: number, doneQty: number, fgType = "BIG POWER CABLE - ARD", sfgBom: string | null = null): LineIn => ({ prodOrder, fgType, stage, sfgItem, netQty, doneQty, balance: netQty - doneQty, sfgBom });
/** A 3.5C x 300 strip cable of `km`, conductor and insulation done, laying `laid` km. */
const cable = (o: string, km: number, laid = 0, size = 300, bom = "ARM-A") => [
  ln(o, "CONDUCTOR", `${size} SQ. MM. SHAPED CONDUCTOR - IS`, 3 * km, 3 * km),
  ln(o, "INSULATION", `${size} SQ. MM. SHAPED INSULATION CORE - XLPE`, 3 * km, 3 * km),
  ln(o, "LAYING", "LAID", km, laid),
  ln(o, "INNER", "INNER", km, 0),
  ln(o, "ARMOURING", "ARMOUR", km, 0, undefined, bom),
  ln(o, "FINISH", "FG (XLPE)", km, 0),
];
const armour = new Map([["ARM-A", "STEEL STRIP 4*0.80 MM (IS)"], ["ARM-B", "STEEL WIRE 1.40 MM (IS)"]]);
const order = (prodOrder: string, lotNo: string | null, runOrderInLot = 1, more: Partial<OrderIn> = {}): OrderIn => ({
  prodOrder, party: "X", cable: "c", lotNo, runOrderInLot, supplyFrom: null, finishBalKm: null, armouringBalKm: null, conductorBalCoreKm: null, pendingFrom: null,
  onHold: false, urgent: false, customerDate: null, promisedOn: null, addedAt: null, remarks: null, ...more,
});
const lot = (lotNo: string, runOrder: number, approved = true): LotIn => ({ lotNo, runOrder, approvedByMd: approved, sentToPlant: approved, status: approved ? "Approved" : "Draft", whatClubbed: null });
const job = (day: string, machine: string, process: string, prodOrder: string, lot: string, qty: number, sizeCore = "–"): PlanIn => ({ day, machine, process, prodOrder, lot, qty, unit: "km", sizeCore, feed: "ok", feedStatus: "ok", job: "j" });

describe("order profile", () => {
  it("reads product, size, type, insulation and armour from SFG and the BOM", () => {
    const p = profileOf("A", cable("A", 10, 4), armour);
    expect(p).toMatchObject({ product: "Cable", category: "BIG", conductorSize: 300, conductorType: "SHAPED", insulation: "XLPE", armour: "STEEL STRIP 4*0.80 MM (IS)", km: 10, leftKm: 10, conductorStarted: true, pending: "Laying" });
    const acsr = profileOf("R", [ln("R", "CONDUCTOR", "ACSR : RACCOON CONDUCTOR - 80 SQ. MM. (6/1/4.09)", 300, 110, "7 STRAND")], armour);
    expect(acsr).toMatchObject({ product: "ACSR", conductorSize: 80, km: 300, leftKm: 190, armoured: false });
  });
});

describe("lot checks", () => {
  const a = profileOf("A", cable("A", 10), armour);
  it("passes an order that matches the lot", () => {
    const b = profileOf("B", cable("B", 20), armour);
    expect(failed(lotChecks(a, [b], false))).toEqual([]);
  });
  it("names each failed check: size, armour and lot km", () => {
    const big = profileOf("B", cable("B", 75, 0, 240, "ARM-B"), armour);
    expect(failed(lotChecks(a, [big], false)).map((c) => c.label)).toEqual(["Conductor size (sq mm)", "Armour (ERP BOM)", "Lot km (limit 80)"]);
  });
  it("an order whose conductor has not started waits unless a running lot makes the size (CR-E-22)", () => {
    const fresh = profileOf("N", cable("N", 5).map((l) => ({ ...l, doneQty: 0, balance: l.netQty })), armour);
    const member = profileOf("B", cable("B", 5), armour);
    expect(failed(lotChecks(fresh, [member], false)).map((c) => c.code)).toEqual(["CR-E-22"]);
    expect(failed(lotChecks(fresh, [member], true))).toEqual([]);
  });
  it("insulation is shown but never stops the lot (CR-E-28: where possible)", () => {
    const pvc = profileOf("P", cable("P", 5).map((l) => (l.stage === "INSULATION" ? { ...l, sfgItem: "300 SQ. MM. SHAPED INSULATION CORE - PVC" } : l)), armour);
    const cs = lotChecks(pvc, [a], false);
    expect(cs.find((c) => c.code === "CR-E-28")).toMatchObject({ ok: false, blocking: false });
    expect(failed(cs)).toEqual([]);
  });
});

describe("expected dates, lot states and proposals", () => {
  const lines = [...cable("A", 7), ...cable("B", 14), ...cable("C", 7)];
  const orders = [order("A", "L1"), order("B", "L2"), order("C", null)];
  const lots = [lot("L1", 1), lot("L2", 2)];
  const profiles = new Map(orders.map((o) => [o.prodOrder, profileOf(o.prodOrder, lines, armour)]));
  const plan = [
    job("2026-11-23", "Armouring 5", "Armouring", "A", "L1", 7),
    job("2026-11-24", "Extruder 52", "Extruder", "A", "L1", 7, "OUTER sheath"),
    job("2026-11-24", "Armouring 5", "Armouring", "B", "L2", 7),
  ];
  const etas = expectedDates(orders, lots, profiles, plan, "2026-11-23");

  it("takes the last outer-sheath day from the cards, else estimates at 7 km a day after the order's last job or the queue", () => {
    expect(etas.get("A")).toMatchObject({ fgReady: "2026-11-24", estimated: false, armouringEnd: "2026-11-23" });
    // B: 14 km, none sheathed on the cards; follows its own last job (24 Nov) + 2 days + 1 for the outer sheath.
    expect(etas.get("B")).toMatchObject({ fgReady: "2026-11-27", estimated: true });
    // C: in no lot, queues after Armouring 5's last card day (24 Nov): 7 km = 1 day + 1.
    expect(etas.get("C")).toMatchObject({ fgReady: "2026-11-26", estimated: true });
  });

  it("marks running, next and draft lots", () => {
    const views = lotViews([...lots, lot("L3", 3, false)], orders, profiles, etas, plan, "2026-11-23");
    expect(views.map((v) => [v.lotNo, v.state])).toEqual([["L1", "RUNNING"], ["L2", "NEXT"], ["L3", "DRAFT"]]);
    expect(views[0].now).toBe("Armouring 5 – today 7 km");
  });

  it("proposes the matching lot with its date and the delay to later lots; a new lot goes last", () => {
    const views = lotViews(lots, orders, profiles, etas, plan, "2026-11-23");
    const [best] = suggestLots(profiles.get("C")!, views, orders, profiles, etas);
    expect(best).toMatchObject({ lotNo: "L1", fits: true, fgReady: "2026-11-25", laterDelayDays: 1, later: [{ lotNo: "L2", was: "2026-11-27", now: "2026-11-28" }] });
    expect(newLotDate(profiles.get("C")!, views, "2026-11-23")).toBe("2026-11-29");
  });
});

describe("traffic jam and lateness", () => {
  it("counts cable waiting in front of each stage, Kharagpur and Poly Park apart", () => {
    const lines = [ln("P726Y-1", "INNER", "i", 10, 10), ln("P726Y-1", "ARMOURING", "a", 10, 2), ln("P126Y-9", "INNER", "i", 5, 5), ln("P126Y-9", "ARMOURING", "a", 5, 0)];
    const arm = trafficJam(lines, 14).find((j) => j.stage === "Armouring")!;
    expect(arm).toMatchObject({ kgpKm: 8, ppKm: 5, days: 3.14, jam: true });
    expect(trafficJam(lines).find((j) => j.stage === "Armouring")!.jam).toBe(false);
  });
  it("green before the customer's date, amber up to 5 days late, red after", () => {
    expect(lateness("2026-12-01", "2026-12-03")).toEqual({ days: -2, tone: "ok" });
    expect(lateness("2026-12-05", "2026-12-03")).toEqual({ days: 2, tone: "warn" });
    expect(lateness("2026-12-10", "2026-12-03")).toEqual({ days: 7, tone: "late" });
    expect(lateness("2026-12-10", null)).toEqual({ days: null, tone: null });
  });
});
