import { describe, expect, it } from "vitest";
import { planDrums, sizeText, type DrumGrids, type OrderDrum } from "../../lib/cards/build-drums";
import { drumAssemblyCard, drumChanges, drumRequirementCard, MISSING } from "../../lib/cards/drums";
import type { PlanRow } from "../../lib/cards/sheet";

const D0 = "2026-11-23";
// The drum of each order, as the sync fills RaccoonDrum from the RAW MATERIALS REQUIREMENT sheet.
const drum = (ref: string, drumCode: string, drumSize: string, drumKm: number): OrderDrum => ({ prodOrder: `P726Y-00${ref}`, drumCode, drumSize, drumKm });
const drums = [
  drum("267", "A", "84×35×38×3 + extra segment", 0.5),
  drum("268", "A", "84×35×38×3 + extra segment", 0.5),
  drum("175", "B", "48×20×28×2.25 RDSO", 1),
  drum("300", "C", "60×30×32×3", 2),
  drum("401", "D4", "99×9×9×9", 1),
];
const stockGrid = (drums84: unknown) => [
  ["Drum code", "Drum size (as per contract)", "Current stock (fill)", "Flange stock KHARAGPUR (nos)", "Flange stock POLY PARK (nos)"],
  ["A", "84 X 35 X 38 X 3 + EXTRA SEGMENT", drums84, 0, 0],
  ["B", "48 X 20 X 28 X 2.25 - RDSO", "", 4, 100],
  ["C", "60 X 30 X 32 X 3", 0, "(shared)", ""],
  ["", "TOTAL", 3, "", ""],
];
const grids = (drums84: unknown = 3): DrumGrids => ({ stock: stockGrid(drums84) });
const job = (day: string, ref: string, qty: number, over: Partial<PlanRow> = {}): PlanRow => ({
  version: "", rowNo: 0, day, process: "Sheathing", machine: "Extruder 51", prodOrder: `P726Y-00${ref}`, mc: "", partyCable: "Laser · 3C×300", lot: "PL-1", qty, unit: "km",
  sizeCore: "OUTER sheath", material: "", feed: "", feedStatus: "ok", job: "Outer sheath", ...over,
});

// Two orders on 500 m drums. 267: 0.7 km then 0.6 km. 268: 0.75 km then 0.1 km.
const sheath = [
  job("2026-11-27", "267", 0.7),
  job("2026-11-28", "267", 0.6),
  job("2026-11-27", "268", 0.75),
  job("2026-11-28", "268", 0.1),
  job("2026-11-27", "267", 5, { sizeCore: "INNER sheath" }),
  job("2026-11-27", "267", 5, { machine: "Skip 10" }),
];

describe("drum need from the plan", () => {
  it("writes RM drum names the way the cards print them", () => {
    expect(["DRUM - 84 X 35 X 38 X 3 + EXTRA SEGMENT", "DRUM - 48 X 20  X 28 X 2.25 - RDSO", "DRUM 48 X 20 X 32 X 2.25", "DRUM - 76 X 40 X 38 X 3 + Extra Segment", "STEEL DRUM - 2130 X 890 X 965"].map(sizeText)).toEqual([
      "84×35×38×3 + extra segment",
      "48×20×28×2.25 RDSO",
      "48×20×32×2.25",
      "76×40×38×3 + extra segment",
      "STEEL DRUM - 2130×890×965",
    ]);
  });

  it("rounds halves up on a day, rounds up on the order's last day, and uses stock first per drum code", () => {
    const { need, stock } = planDrums(sheath, grids(), D0, drums);
    // 267: 1.4 → 1 drum, then 2.6 → 3 on its last day (2 more). 268: 1.5 → 2, then 1.7 → 2 (nothing more).
    expect(need.map((r) => [r.rowNo, r.readyBy, r.usedOn, r.prodOrder, r.drumsNeeded, r.fromStock, r.toAssemble, r.late])).toEqual([
      [0, "2026-11-23", "2026-11-27", "P726Y-00267", 1, 1, 0, false],
      [1, "2026-11-23", "2026-11-27", "P726Y-00268", 2, 2, 0, false],
      [2, "2026-11-24", "2026-11-28", "P726Y-00267", 2, 0, 2, false],
    ]);
    expect(need[0]).toMatchObject({ drumSize: "84×35×38×3 + extra segment", drumCode: "A", partyCable: "Laser · 3C×300", lot: "PL-1", note: null });
    // The stock sheet by drum code: a row with no code is skipped, an empty stock cell is not known, text is not a number.
    expect(stock.map((s) => [s.drumCode, s.drumSize, s.drums, s.flangesKgp, s.flangesPp])).toEqual([
      ["A", "84 X 35 X 38 X 3 + EXTRA SEGMENT", 3, 0, 0],
      ["B", "48 X 20 X 28 X 2.25 - RDSO", null, 4, 100],
      ["C", "60 X 30 X 32 X 3", 0, null, null],
    ]);
  });

  it("counts Raccoon drums by the order's metres per drum, due the day before on the machine named", () => {
    const { need, assembly } = planDrums([job("2026-11-23", "300", 2.1, { machine: "Skip 8", feedStatus: "drum", sizeCore: "–", partyCable: "Laser · ACSR" })], grids(), D0, drums);
    expect(need).toMatchObject([{ readyBy: "2026-11-22", late: true, drumSize: "60×30×32×3", drumCode: "C", drumsNeeded: 2, fromStock: 0, toAssemble: 2 }]);
    // Late: to be made on day 0. Its flange stock is text in the sheet.
    expect(assembly).toMatchObject([{ assembleBy: D0, was: "2026-11-22", drumCode: "C", drums: 2, flangesNeeded: 4, flangesFrom: "To confirm", usedOn: "2026-11-23" }]);
    expect(drumRequirementCard(need, [], D0).rows[0]).toMatchObject({ usedOn: "Skip 8, 23 Nov", remark: "Bare conductor – wound straight on this drum", remarkAttention: false, late: true });
    expect(drumAssemblyCard(assembly, [], D0, need).rows[0]).toMatchObject({ usedOn: "Skip 8, 23 Nov", late: true });
  });

  it("counts none of the drums of an order not in the RM sheet, and asks Samrat to fill it", () => {
    const { need, assembly } = planDrums([job("2026-11-30", "999", 1.2), job("2026-12-01", "999", 1)], grids(), D0, drums);
    expect(need).toMatchObject([{ drumSize: MISSING, drumCode: null, drumsNeeded: 0, fromStock: 0, toAssemble: 0, note: null }]);
    expect(assembly).toEqual([]);
    const card = drumRequirementCard(need, [], D0);
    expect(card.rows).toEqual([]);
    expect(card.facts.needed).toBe(0);
    expect(card.needsAction).toEqual([
      { size: MISSING, known: false, problem: "1 order: P726Y-00999 Laser", todo: "Samrat to fill the drum code for these contracts in the RAW MATERIALS REQUIREMENT sheet", buy: 0 },
    ]);
  });

  it("keeps only drums due before day 15", () => {
    const { need } = planDrums([job("2026-12-11", "401", 1), job("2026-12-12", "401", 1)], grids(), D0, drums);
    expect(need.map((r) => [r.readyBy, r.drumsNeeded])).toEqual([["2026-12-07", 1]]);
  });

  it("puts late drums first and runs the flanges down per drum code, held-up rows too", () => {
    const plan = [job("2026-11-27", "175", 1), job("2026-11-28", "175", 2), job("2026-11-29", "175", 1), job("2026-11-25", "401", 1)];
    const { need, assembly, stock } = planDrums(plan, grids(), D0, drums);
    // 48″: 4 flanges at Kharagpur, 100 at Poly Park. 1 drum takes 2; the next 2 drums take Kharagpur's last 2 and
    // 2 from Poly Park; the last takes 2 from Poly Park. None is held up.
    expect(assembly.map((r) => [r.rowNo, r.assembleBy, r.was, r.prodOrder, r.drums, r.flangesNeeded, r.flangesFrom])).toEqual([
      [0, D0, "2026-11-21", "P726Y-00401", 1, 2, "Not in the Drum Stock sheet"],
      [1, "2026-11-23", null, "P726Y-00175", 1, 2, "Kharagpur stock"],
      [2, "2026-11-24", null, "P726Y-00175", 2, 4, "Kharagpur 2 + Poly Park 2 (shift)"],
      [3, "2026-11-25", null, "P726Y-00175", 1, 2, "Poly Park 2 (shift)"],
    ]);
    const card = drumAssemblyCard(assembly, stock, D0, need);
    expect(card.rows.map((r) => r.flangesFrom)).toEqual(assembly.map((r) => r.flangesFrom));
    expect(card.cannot).toEqual([
      { code: "D4", size: "99×9×9×9", known: true, drums: 1, problem: "99×9×9×9 (D4) is not in the Drum Stock sheet (for Laser)", todo: "Plant to give stock and flanges", buy: 0 },
    ]);
    expect(drumRequirementCard(need, stock, D0).needsAction.map((n) => [n.size, n.problem, n.todo])).toEqual([
      ["99×9×9×9", "1 drum should already be ready (needed before 23 Nov) and is not in stock", "Drum team to assemble these first"],
      ["99×9×9×9", "1 drum to be made: 99×9×9×9 (D4) is not in the Drum Stock sheet", "99×9×9×9 (D4) is not in the Drum Stock sheet – plant to give stock and flanges"],
      ["48×20×28×2.25 RDSO", "4 drums to be made: 8 flanges needed: Kharagpur has 4, Poly Park 100", "Shift 4 flanges from Poly Park"],
    ]);
  });

  it("names the tab when a heading is missing", () => {
    expect(() => planDrums(sheath, { stock: [["Drum code", "Size"]] }, D0, drums)).toThrow(/Drum Stock.*Drum size/);
  });
});

describe("what changed since the previous issue", () => {
  it("compares the drums to assemble, order by order", () => {
    const prev = { issueDate: D0, rev: 1, d0: D0 };
    const issue = { issueDate: "2026-11-24", rev: 1, d0: "2026-11-24", issueNote: "No 84″ drums left." };
    const c = drumChanges(issue, prev, planDrums([...sheath, job("2026-11-30", "999", 1)], grids(0), issue.d0, drums).need, planDrums(sheath, grids(), D0, drums).need);
    expect(c).toEqual({
      name: "24-Nov Rev 1", prevName: "23-Nov Rev 1", note: "No 84″ drums left.", upTo: "8 Dec", toMake: 5, prevToMake: 2,
      rows: [
        { order: "Laser · 3C×300 (267)", size: "84×35×38×3", known: true, prev: "2 drums, 24 Nov", now: "3 drums, 24 Nov (1 late)" },
        { order: "Laser · 3C×300 (268)", size: "84×35×38×3", known: true, prev: "none", now: "2 drums (2 late)" },
        { order: "Laser · 3C×300 (999)", size: MISSING, known: false, prev: "none", now: "none" },
      ],
    });
  });
});
