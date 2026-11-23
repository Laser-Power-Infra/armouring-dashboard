import { describe, expect, it } from "vitest";
import { planCard1 } from "../../lib/cards/plan";
import { parseSources, pullCheck, type Tables } from "../../lib/cards/sources";

// One 3.5C×300 strip cable of 2 km in an approved lot: conductor made, nothing else. docs/final guide for card 1.md, section 4.
const line = (prodOrder: string, stage: string, sfgCode: string, sfgItem: string, netQty: number, doneQty: number, extra: Partial<Tables["lines"][number]> = {}) => ({
  prodOrder, stage, sfgCode, sfgItem, netQty, doneQty, balance: netQty - doneQty, fgType: "BIG POWER CABLE - ARD", scope: "Kharagpur", sfgBom: sfgCode, ...extra,
});
const order = (prodOrder: string, extra: Partial<Tables["orders"][number]> = {}) => ({
  prodOrder, mcNo: "MC-1", party: "Adani Electricity", cable: "3.5 CORE X 300 SQ. MM. AL/ARD - STRIP (XLPE)", sizeSqmm: 300, cores: 3.5, insulation: "XLPE", lotNo: "PL-001", runOrderInLot: 1, supplyFrom: null, ...extra,
});
const cable = (o: string) => [
  line(o, "CONDUCTOR", "C300", "300 SQ. MM. SHAPED CONDUCTOR", 6, 6),
  line(o, "CONDUCTOR", "C150", "150 SQ. MM. SHAPED CONDUCTOR", 2, 2),
  line(o, "INSULATION", "I300", "300 SQ. MM. SHAPED INSULATION CORE - XLPE", 6, 0),
  line(o, "INSULATION", "I150", "150 SQ. MM. SHAPED INSULATION CORE - XLPE", 2, 0),
  line(o, "LAYING", "LAY", "3.5 CORE X 300 SQ. MM. AL/XLPE (LAID)", 2, 0),
  line(o, "INNER", "INN", "3.5 CORE X 300 SQ. MM. AL/XLPE INNER", 2, 0),
  line(o, "ARMOURING", "ARM", "3.5 CORE X 300 SQ. MM. AL/ARD - STRIP (XLPE) (AR)", 2, 0),
  line(o, "FINISH", "FIN", "3.5 CORE X 300 SQ. MM. AL/ARD - STRIP (XLPE)", 2, 0),
];
const bom = (sfgBom: string, material: string, kgPerKm: number) => ({ sfgBom, lineNo: 1.001, materialCode: material, material, kgPerKm });
const tables = (over: Partial<Tables> = {}): Tables => ({
  lots: [{ lotNo: "PL-001", runOrder: 1, approvedByMd: true }, { lotNo: "PL-002", runOrder: 2, approvedByMd: false }],
  orders: [order("P726Y-00001")],
  lines: cable("P726Y-00001"),
  bom: [bom("I300", "LT XLPE", 130), bom("I150", "LT XLPE", 80), bom("INN", "PVC COMPOUND 1.48", 100), bom("ARM", "STEEL STRIP 4*0.80 MM (IS)", 875), bom("FIN", "HDPE COMPOUND (B)", 150)],
  rm: [],
  men: [],
  ...over,
});
const brief = (t: Tables) => planCard1(t, "2026-11-20").rows.map((r) => `${r.day.slice(8)} ${r.machine} ${r.qty} ${r.unit} ${r.job}`);

describe("Card 1 plan", () => {
  it("moves one cable through every stage, each stage fed only by stock of earlier days", () => {
    expect(brief(tables())).toEqual([
      "20 Extruder 22 6 core km XLPE",
      "20 Extruder 22 2 core km XLPE",
      "21 Laying 5 2 km Laying",
      "22 Extruder 52 2 km Inner sheath",
      "23 Armouring 5 2 km Strip 4×0.80",
      "24 Extruder 52 2 km Outer sheath",
    ]);
  });

  it("writes the row as the Card plan tab has it", () => {
    const rows = planCard1(tables(), "2026-11-20").rows;
    expect(rows[0]).toMatchObject({
      day: "2026-11-20", process: "Extruder", machine: "Extruder 22", prodOrder: "P726Y-00001", mc: "MC-1", partyCable: "Adani · 3.5C×300 Al strip XLPE", lot: "PL-001",
      qty: 6, unit: "core km", sizeCore: "300 sq mm – FULL core", material: "LT XLPE 780 kg", feed: "Conductor: ready in stock (6 core km)", feedStatus: "ok", job: "XLPE",
    });
    expect(rows[1]).toMatchObject({ qty: 2, sizeCore: "150 sq mm – HALF core", material: "LT XLPE 160 kg" });
    expect(rows[2].feed).toBe("Insulated core (full core): from Extruder 22 on 20 Nov · Insulated core (half core): from Extruder 22 on 20 Nov");
    expect(rows[3]).toMatchObject({ sizeCore: "INNER sheath", feed: "Laid cable: from Laying 5 on 21 Nov", material: "PVC COMPOUND 1.48 200 kg" });
    expect(rows[5]).toMatchObject({ sizeCore: "OUTER sheath", feed: "Armoured cable: from Armouring 5 on 23 Nov" });
  });

  it("plans only approved lots, and skips ABJ, dead / old / free stock and orders with no order lines", () => {
    const skipped = [order("P726Y-00002", { lotNo: "PL-002" }), order("P726Y-00003", { party: "ABJ Engineering" }), order("P726Y-00004", { supplyFrom: "Issue free stock order - 2 km" }), order("P726Y-00005", { supplyFrom: "Dead Stock" }), order("P726Y-00006", { lotNo: null })];
    const t = tables({ orders: [order("P726Y-00001"), ...skipped, order("P726Y-00007")], lines: [...cable("P726Y-00001"), ...skipped.flatMap((o) => cable(o.prodOrder))] });
    const plan = planCard1(t, "2026-11-20");
    expect([...new Set(plan.rows.map((r) => r.prodOrder))]).toEqual(["P726Y-00001"]);
    expect(plan.notPlanned).toEqual([]);
  });

  it("makes conductor on the machine of its size and lists a size with no machine", () => {
    const lines = [
      line("P726Y-00001", "CONDUCTOR", "C95", "95 SQ. MM. SHAPED CONDUCTOR", 4, 0),
      line("P726Y-00001", "CONDUCTOR", "C10", "10 SQ. MM. COMPACT CONDUCTOR", 4, 0),
      line("P726Y-00001", "INSULATION", "I95", "95 SQ. MM. SHAPED INSULATION", 4, 0),
      line("P726Y-00001", "LAYING", "LAY", "4 CORE X 95 SQ. MM. (LAID)", 1, 0),
    ];
    const plan = planCard1(tables({ orders: [order("P726Y-00001", { cores: 4, sizeSqmm: 95 })], lines }), "2026-11-20");
    expect(plan.rows[0]).toMatchObject({ machine: "Skip (12+7)-1", process: "Skip strander", qty: 4, job: "Conductor", feed: "Aluminium wire drawn on WD14" });
    expect(plan.rows[1]).toMatchObject({ day: "2026-11-21", machine: "Extruder 22", qty: 4, feed: "Conductor: from Skip (12+7)-1 on 20 Nov" });
    expect(plan.notPlanned).toEqual(["P726Y-00001 (Adani): 10 sq mm conductor, 4 core km – machine to confirm"]);
  });

  it("makes only conductor and insulation of an HT order, and ACSR on Skip 10 with drums from day 3", () => {
    const ht = [
      line("P126Y-00900", "CONDUCTOR", "HC", "300 SQ. MM. COMPACT CONDUCTOR", 30, 0, { scope: "Core for Poly Park (P1)", fgType: "HT POWER CABLE - ARD" }),
      line("P126Y-00900", "INSULATION", "HI", "300 SQ. MM. CORE INSULATED 33kv (SIO)", 30, 0, { scope: "Core for Poly Park (P1)", fgType: "HT POWER CABLE - ARD" }),
      line("P126Y-00900", "LAYING", "HL", "3 CORE X 300 SQ. MM. (LAID)", 10, 0, { scope: "Core for Poly Park (P1)", fgType: "HT POWER CABLE - ARD" }),
    ];
    const acsr = [line("P726Y-00263", "CONDUCTOR", "RAC", "ACSR : RACCOON CONDUCTOR - 80 SQ. MM. (6/1/4.09)", 100, 0, { fgType: "7 STRAND" })];
    const t = tables({ orders: [order("P126Y-00900", { cores: 3 }), order("P726Y-00263", { cable: "ACSR : RACCOON CONDUCTOR - 80 SQ. MM.", cores: null, sizeSqmm: 80 })], lines: [...ht, ...acsr] });
    const rows = planCard1(t, "2026-11-20").rows;
    expect([...new Set(rows.filter((r) => r.prodOrder === "P126Y-00900").map((r) => `${r.machine} ${r.job}`))]).toEqual(["MS-11 HT conductor", "Sioplas 4 HT insulation"]);
    // MS-11 makes 12 a day, Sioplas 4 takes 9 a day from the day after; HT conductor stock is held to 27 core km.
    expect(rows.filter((r) => r.machine === "MS-11").map((r) => r.qty)).toEqual([12, 12, 6]);
    expect(rows.filter((r) => r.machine === "Sioplas 4").map((r) => r.qty)).toEqual([9, 9, 9, 3]);
    const skip10 = rows.filter((r) => r.machine === "Skip 10");
    expect(skip10.map((r) => [r.qty, r.feedStatus])).toEqual([[23, "ok"], [23, "ok"], [23, "ok"], [23, "drum"], [8, "drum"]]);
    expect(skip10[0].partyCable).toBe("Adani · ACSR : RACCOON CONDUCTOR - 80 SQ. MM.");
  });
});

describe("Card 1 sources", () => {
  it("reads the columns the guide names", () => {
    const row = (cells: Record<number, unknown>, width: number) => Array.from({ length: width }, (_, i) => cells[i] ?? "");
    const t = parseSources({
      lots: [row({ 0: 1, 1: "PL-001", 8: true }, 12), row({ 0: 2, 1: "PL-002", 8: "FALSE" }, 12), row({ 0: 3 }, 12)],
      orders: [row({ 0: "P726Y-00001", 1: "MC-1", 2: "Adani", 3: "3.5 CORE", 4: 300, 5: 3.5, 7: "XLPE", 17: "PL-001", 18: 2, 20: "Manufacture" }, 22), row({ 0: "P726Y-00002", 4: "-", 5: "-" }, 22)],
      // The second line repeats the first (as the SFG pull did on 23-Nov): kept once.
      lines: [0, 1].map(() => row({ 0: "P726Y-00001", 5: "BIG POWER CABLE - ARD", 7: "LAYING", 8: "MS1", 9: "3.5 CORE X 300", 10: 20, 11: "1,907", 12: 0.93, 14: "Kharagpur", 15: "U1" }, 16)),
      bom: [row({ 0: "U1", 4: 1.001, 5: "RL1", 6: "PP FILLER", 7: 20, 8: "KG" }, 9)],
      rm: [row({ 2: "RL1", 3: "PP FILLER", 11: "4,000" }, 12), row({ 2: "RL2", 3: "TAPE" }, 12), row({ 3: "no code" }, 12)],
      men: [row({ 0: "Armouring No 5", 3: true, 5: 3, 6: "Day: mostly 5" }, 14), row({ 0: "Extruder No 35", 3: false, 6: "Day: mostly 3 (avg 3.3)" }, 14), row({ 0: "Extruder No 51", 6: "No ERP code – no history" }, 14), row({ 0: "Boiler 7", 5: 3 }, 14)],
      readme: "",
    });
    expect(t.lots).toEqual([{ lotNo: "PL-001", runOrder: 1, approvedByMd: true }, { lotNo: "PL-002", runOrder: 2, approvedByMd: false }]);
    expect(t.orders[0]).toEqual({ prodOrder: "P726Y-00001", mcNo: "MC-1", party: "Adani", cable: "3.5 CORE", sizeSqmm: 300, cores: 3.5, insulation: "XLPE", lotNo: "PL-001", runOrderInLot: 2, supplyFrom: "Manufacture" });
    expect(t.orders[1]).toMatchObject({ sizeSqmm: null, cores: null, lotNo: null });
    expect(t.lines).toHaveLength(1);
    expect(t.lines[0]).toMatchObject({ stage: "LAYING", sfgCode: "MS1", netQty: 20, doneQty: 1907, balance: 0.93, scope: "Kharagpur", sfgBom: "U1" });
    expect(t.bom).toEqual([{ sfgBom: "U1", lineNo: 1.001, materialCode: "RL1", material: "PP FILLER", kgPerKm: 20 }]);
    expect(t.rm).toEqual([{ itemCode: "RL1", item: "PP FILLER", qtyForPlanning: 4000 }, { itemCode: "RL2", item: "TAPE", qtyForPlanning: 0 }]);
    expect(t.men).toEqual([{ machine: "Armouring 5", menPerShift: 3, mustRunDaily: true }, { machine: "Extruder 35", menPerShift: 3, mustRunDaily: false }, { machine: "Extruder 51", menPerShift: null, mustRunDaily: false }]);
  });

  it("does not build from a pull that failed, was skipped or is more than 18 hours old", () => {
    const now = new Date("2026-11-20T12:00:00Z"); // 17:30 IST
    expect(pullCheck("2026-11-20 15:02 IST from the SFG dashboard. Rows: order lines 605", now)).toEqual({ pulledAt: "2026-11-20 15:02 IST", problem: null });
    expect(pullCheck("2026-11-19 22:00 IST from the SFG dashboard", now).problem).toMatch(/19\.5 h old/);
    expect(pullCheck("2026-11-20 15:02 IST – FAILED: login", now).problem).toMatch(/FAILED/);
    expect(pullCheck("skipped: dashboard down", now).problem).toMatch(/skipped/);
    expect(pullCheck("", now).problem).toMatch(/no pull time/);
  });
});
