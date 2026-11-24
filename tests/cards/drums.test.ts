import { describe, expect, it } from "vitest";
import { drumAssemblyCard, drumRequirementCard, heldUp, MISSING } from "../../lib/cards/drums";
import { parseDrumAssembly, parseDrumNeed, parseDrumStock, sizeKey, type DrumAssemblyRow } from "../../lib/cards/sheet";
import { fixture } from "./testdb";

// Figures from the same drum need as templates/Drum_*_New_Layout.html, under the owner's rules of 23-Nov:
// flanges from Kharagpur, then Poly Park, then BUY (rule 10); drums of a size not known are not counted (rule 8).
// These tabs are from before 24-Nov-26: they have no drum codes, so rows are matched to the stock by size.
const stock = parseDrumStock(fixture("drum-stock"));
const inCard = <T extends { index: number | null }>(weeks: T[][]) => weeks.flat().filter((c) => c.index !== null);

describe("drum assembly card", () => {
  const a = drumAssemblyCard(parseDrumAssembly(fixture("drum-assembly")), stock, "2026-11-17");

  it("totals drums to make, held up and late", () => {
    expect(a.facts).toEqual({ period: "Drums to be made from 17 Nov to 1 Dec 2026", toMake: 164, flanges: 328, canMake: 108, heldUp: 56, late: 29, d0: "17 Nov" });
    expect(a.total).toEqual({ drums: 164, flanges: 328 });
  });

  it("colours each day by what is held up", () => {
    expect(inCard(a.calendar).map((c) => [c.n, c.held, c.tone])).toEqual([
      [29, 19, "shortd"], [0, 0, "idle"], [6, 0, "work"], [9, 0, "work"], [10, 0, "work"], [13, 4, "shortd"],
      [23, 14, "shortd"], [19, 10, "shortd"], [17, 8, "shortd"], [19, 1, "shortd"], [11, 0, "work"], [8, 0, "work"], [0, 0, "idle"],
      [0, 0, "idle"], [0, 0, "idle"],
    ]);
    expect(inCard(a.calendar).slice(0, 3).map((c) => c.text)).toEqual(["19 held up", "none", "all ok"]);
  });

  it("says which sizes cannot be made yet: Poly Park flanges are shifted first, the rest bought", () => {
    expect(a.cannot.map((c) => [c.size, c.drums, c.problem, c.todo, c.buy])).toEqual([
      ["84×35×38×3 + extra segment", 55, "110 flanges needed: Kharagpur has 0, Poly Park 2 (for Adani)", "Shift 2 flanges from Poly Park, then BUY 108 flanges", 108],
      ["70×35×38×3", 1, "2 flanges needed: Kharagpur has 0, Poly Park 0 (for Laser)", "BUY 2 flanges", 2],
    ]);
  });

  it("lists drums to make day by day, late ones under the first day; a size not known is not counted", () => {
    expect(a.rows[0]).toMatchObject({ first: true, makeBy: "17 Nov", dayTotal: "29 drums", late: true, drums: 4, flanges: 8, flangesFrom: "Poly Park 2 (shift) + BUY 6", buy: 6, held: true, orderLot: "P726Y-00267 · PL-001", usedOn: "Outer sheath, 17 Nov" });
    expect(a.rows[2]).toMatchObject({ first: false, flangesFrom: "Kharagpur stock", held: false });
    expect(a.rows.find((r) => r.makeBy === "19 Nov")).toMatchObject({ late: false, drums: 6, usedOn: "Skip 10, 20 Nov" });
    // 36″: Kharagpur's 2 flanges first, the rest shifted from Poly Park – not held up.
    expect(a.rows.find((r) => r.size.text === "36×14×23×2")).toMatchObject({ flangesFrom: "Kharagpur 2 + Poly Park 2 (shift)", held: false });
    expect(a.rows.some((r) => !r.size.known)).toBe(false);
  });

  it("holds up a size it has no stock figure for, instead of dropping it", () => {
    const row: DrumAssemblyRow = { version: "", rowNo: 0, assembleBy: "2026-11-20", was: null, drumSize: "99×9×9×9", drumCode: null, drums: 2, flangesNeeded: 4, flangesFrom: "", prodOrder: "P7-1", partyCable: "A · B", lot: "PL-1", usedOn: "2026-11-24" };
    expect(heldUp([row], stock)[0]).toMatchObject({ held: true, flangesFrom: "Not in the Drum Stock sheet" });
    // A drum code not in the stock sheet is held up the same way.
    expect(heldUp([{ ...row, drumCode: "MD9" }], stock)[0]).toMatchObject({ held: true, flangesFrom: "Not in the Drum Stock sheet" });
  });

  it("uses flanges up in date order: Kharagpur first, then Poly Park, then BUY", () => {
    const row = (rowNo: number, assembleBy: string, drums: number): DrumAssemblyRow => ({ version: "", rowNo, assembleBy, was: null, drumSize: "76×40×36×3", drumCode: null, drums, flangesNeeded: drums * 2, flangesFrom: "", prodOrder: "P7-1", partyCable: "A · B", lot: "PL-1", usedOn: assembleBy });
    // 76″: 43 flanges at Kharagpur, 193 at Poly Park. 20 drums take 40 at Kharagpur; the next 2 take Kharagpur's
    // last 3 and 1 from Poly Park; 100 more take the other 192 from Poly Park and must buy 8.
    expect(heldUp([row(1, "2026-11-21", 2), row(0, "2026-11-20", 20), row(2, "2026-11-22", 100)], stock).map((r) => [r.flangesFrom, r.held])).toEqual([
      ["Kharagpur stock", false],
      ["Kharagpur 3 + Poly Park 1 (shift)", false],
      ["Poly Park 192 (shift) + BUY 8", true],
    ]);
  });
});

describe("flange stock the plant has not filled", () => {
  // 54 inch: the stock cell is empty, so nobody knows how many flanges Kharagpur has.
  const unknown = stock.map((x) => (x.drumSize.startsWith("54") ? { ...x, flangesKgp: null } : x));

  it("holds the drums up and asks to confirm the flanges", () => {
    const a = drumAssemblyCard(parseDrumAssembly(fixture("drum-assembly")), unknown, "2026-11-17");
    expect(a.rows.find((r) => r.size.text === "54×24×32×3")).toMatchObject({ held: true, flangesFrom: "To confirm" });
    expect(a.cannot.find((c) => c.size === "54×24×32×3")).toEqual({ code: sizeKey("54×24×32×3"), size: "54×24×32×3", known: true, drums: 8, problem: "54×24×32×3 flanges at Kharagpur to confirm (for SE Railway)", todo: "Confirm 54×24×32×3 flanges", buy: 0 });
  });

  it("asks for the stock on the requirement card and marks the size", () => {
    const r = drumRequirementCard(parseDrumNeed(fixture("fg-drum-need")), unknown, "2026-11-17");
    expect(r.needsAction.find((n) => n.size === "54×24×32×3")).toMatchObject({ problem: "8 drums to be made: 54×24×32×3 flanges at Kharagpur to confirm", todo: "Confirm 54×24×32×3 flanges" });
    expect(r.bySize.find((x) => x.size === "54×24×32×3")).toMatchObject({ flangesKgp: 0, flangesShort: true });
  });

  it("finds the stock when the card writes the size with a note and the stock sheet without", () => {
    const plain = stock.map((x) => (x.drumSize.startsWith("60") ? { ...x, drumSize: "60 X 30 X 32 X 3", drumCode: "60x30x32x3" } : x));
    const a = drumAssemblyCard(parseDrumAssembly(fixture("drum-assembly")), plain, "2026-11-17");
    expect(a.rows.find((r) => r.size.text.startsWith("60"))).toMatchObject({ held: false, flangesFrom: "Kharagpur stock" });
  });
});

describe("drum requirement card", () => {
  const r = drumRequirementCard(parseDrumNeed(fixture("fg-drum-need")), stock, "2026-11-17");

  it("totals drums needed, in stock and to be made", () => {
    // The 41 drums of the 9 orders with no drum size are not counted (rule 8).
    expect(r.facts).toEqual({ period: "Drums to be ready from 17 Nov to 1 Dec 2026", needed: 241, inStock: 77, toMake: 164, flanges: 328 });
    expect(r.total).toEqual({ needed: 241, inStock: 77, toMake: 164, flanges: 328 });
    expect(r.lateLine).toBe("Already late (needed before 17 Nov): 54 drums, 29 of them still to be made");
  });

  it("colours each day by whether stock covers it", () => {
    expect(inCard(r.calendar).map((c) => [c.n, c.text])).toEqual([
      [29, "all in stock"], [9, "all in stock"], [19, "6 to make"], [9, "9 to make"], [10, "10 to make"], [13, "13 to make"],
      [23, "23 to make"], [19, "19 to make"], [18, "17 to make"], [19, "19 to make"], [11, "11 to make"], [8, "8 to make"], [0, "no drums"],
      [0, "no drums"], [0, "no drums"],
    ]);
    expect(inCard(r.calendar).slice(0, 3).map((c) => c.tone)).toEqual(["work", "work", "shortd"]);
  });

  it("gives size-wise totals with flanges at Kharagpur", () => {
    expect(r.bySize.map((s) => [s.size, s.needed, s.inStock, s.toMake, s.flangesNeeded, s.flangesKgp, s.flangesShort])).toEqual([
      ["84×35×38×3 + extra segment", 60, 5, 55, 110, 0, true],
      ["60×30×32×3 (250 m packing)", 10, 8, 2, 4, 330, false],
      ["48×20×28×2.25 RDSO", 118, 31, 87, 174, 711, false],
      ["76×40×36×3", 10, 2, 8, 16, 43, false],
      ["43×15×28×2.25", 30, 30, 0, 0, 230, false],
      ["54×24×32×3", 9, 1, 8, 16, 127, false],
      ["70×35×38×3", 1, 0, 1, 2, 0, true],
      ["36×14×23×2", 3, 0, 3, 6, 2, true],
    ]);
  });

  it("lists what needs action: late drums, flange shortages (Poly Park, then BUY), sizes not given", () => {
    expect(r.needsAction.map((n) => [n.size, n.problem, n.todo])).toEqual([
      ["84×35×38×3 + extra segment", "19 drums should already be ready (needed before 17 Nov) and are not in stock", "Drum team to assemble these first"],
      ["60×30×32×3 (250 m packing)", "2 drums should already be ready (needed before 17 Nov) and are not in stock", "Drum team to assemble these first"],
      ["76×40×36×3", "8 drums should already be ready (needed before 17 Nov) and are not in stock", "Drum team to assemble these first"],
      ["84×35×38×3 + extra segment", "55 drums to be made: 110 flanges needed: Kharagpur has 0, Poly Park 2", "Shift 2 flanges from Poly Park, then BUY 108 flanges"],
      ["70×35×38×3", "1 drum to be made: 2 flanges needed: Kharagpur has 0, Poly Park 0", "BUY 2 flanges"],
      ["36×14×23×2", "3 drums to be made: 6 flanges needed: Kharagpur has 2, Poly Park 1080", "Shift 4 flanges from Poly Park"],
      [MISSING, "9 orders: P726Y-00187 G.R. Infra, P726Y-00208 Laser, P726Y-00209 Laser, P726Y-00229 G.R. Infra, P726Y-00231 G.R. Infra, P726Y-00234 G.R. Infra, P726Y-00277 Laser, P726Y-00279 Laser, P726Y-00280 Laser", "Samrat to fill the drum code for these contracts in the RAW MATERIALS REQUIREMENT sheet"],
    ]);
  });

  it("lists drums date by date, late ones first", () => {
    expect(r.rows[0]).toMatchObject({ first: true, late: true, needed: 9, fromStock: 5, toMake: 4, orderLot: "P726Y-00267 · PL-001", usedOn: "Outer sheath, 17 Nov", remark: "" });
    expect(r.rows[4]).toMatchObject({ first: false, late: true, usedOn: "Skip 10, 17 Nov", remark: "Bare conductor – wound straight on this drum" });
    expect(r.rows[5].remark).toBe("10 drums on 76″ + 1 on 70″");
    expect(r.rows[6]).toMatchObject({ first: true, late: false, readyBy: "17 Nov", needed: 20 });
    // Orders with no drum size are listed only under Needs action.
    expect(r.rows.some((x) => /to confirm/i.test(x.size.text))).toBe(false);
  });
});
