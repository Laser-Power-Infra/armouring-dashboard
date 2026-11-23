import { describe, expect, it } from "vitest";
import { drumAssemblyCard, drumRequirementCard, heldUp, sizeLabel } from "../../lib/cards/drums";
import { parseDrumAssembly, parseDrumNeed, parseDrumStock, type DrumAssemblyRow } from "../../lib/cards/sheet";
import { fixture } from "./testdb";

// Expected figures are those printed on templates/Drum_Assembly_Card_New_Layout.html and
// templates/Drum_Requirement_Card_New_Layout.html, made from the same drum need.
const stock = parseDrumStock(fixture("drum-stock"));
const inCard = <T extends { index: number | null }>(weeks: T[][]) => weeks.flat().filter((c) => c.index !== null);

describe("drum assembly card", () => {
  const a = drumAssemblyCard(parseDrumAssembly(fixture("drum-assembly")), stock, "2026-11-17");

  it("totals drums to make, held up and late", () => {
    expect(a.facts).toEqual({ period: "Drums to be made from 17 Nov to 1 Dec 2026", toMake: 205, flanges: 410, canMake: 105, heldUp: 100, late: 29, d0: "17 Nov" });
    expect(a.total).toEqual({ drums: 205, flanges: 410 });
  });

  it("colours each day by what is held up", () => {
    expect(inCard(a.calendar).map((c) => [c.n, c.held, c.tone])).toEqual([
      [29, 19, "shortd"], [0, 0, "idle"], [6, 0, "work"], [9, 0, "work"], [10, 0, "work"], [13, 4, "shortd"],
      [23, 14, "shortd"], [19, 10, "shortd"], [17, 8, "shortd"], [20, 2, "shortd"], [27, 18, "shortd"], [25, 18, "shortd"], [3, 3, "shortd"],
      [1, 1, "shortd"], [3, 3, "shortd"],
    ]);
    expect(inCard(a.calendar).slice(0, 3).map((c) => c.text)).toEqual(["19 held up", "none", "all ok"]);
  });

  it("says which sizes cannot be made yet and what to do", () => {
    expect(a.cannot).toEqual([
      { size: "84×35×38×3 + extra segment", known: true, drums: 55, problem: "No 84″ flanges at Kharagpur", todo: "Buy 84″ flanges, or decide another drum size" },
      { size: "70×35×38×3", known: true, drums: 1, problem: "No 70″ flanges at Kharagpur", todo: "Buy 2 flanges, or use a complete 70″ drum from the yard" },
      { size: "Size not known", known: false, drums: 41, problem: "Drum size not given for the order", todo: "Plant to give the drum size for each order" },
      { size: "36×14×23×2", known: true, drums: 3, problem: "Only 2 flanges at Kharagpur", todo: "Shift flanges from Poly Park (1,080 there)" },
    ]);
  });

  it("lists drums to make day by day, late ones under the first day", () => {
    expect(a.rows[0]).toMatchObject({ first: true, makeBy: "17 Nov", dayTotal: "29 drums", late: true, drums: 4, flanges: 8, flangesFrom: "No flanges – to be bought", held: true, orderLot: "P726Y-00267 · PL-001", usedOn: "Outer sheath, 17 Nov" });
    expect(a.rows[2]).toMatchObject({ first: false, flangesFrom: "Kharagpur stock", held: false });
    expect(a.rows.find((r) => r.makeBy === "19 Nov")).toMatchObject({ late: false, drums: 6, usedOn: "Skip 10, 20 Nov" });
    expect(a.rows.find((r) => r.size.text === "36×14×23×2")!.flangesFrom).toBe("Poly Park (only 2 at Kharagpur)");
    expect(a.rows.find((r) => !r.size.known)).toMatchObject({ flangesFrom: "Size not known", held: true });
  });

  it("holds up a size it has no stock figure for, instead of dropping it", () => {
    const row: DrumAssemblyRow = { version: "", rowNo: 0, assembleBy: "2026-11-20", was: null, drumSize: "99×9×9×9", drums: 2, flangesNeeded: 4, flangesFrom: "", prodOrder: "P7-1", partyCable: "A · B", lot: "PL-1", usedOn: "2026-11-24" };
    expect(heldUp([row], stock)[0]).toMatchObject({ held: true, flangesFrom: "Not in the Drum Stock sheet" });
    expect(sizeLabel("SIZE TO CONFIRM")).toEqual({ text: "Size not known", known: false });
    // Anything that is not a size (no dimensions in it) is a size the plant has not given.
    expect(["TBC", "-", "NOT KNOWN", ""].map((x) => sizeLabel(x).known)).toEqual([false, false, false, false]);
    expect(sizeLabel("99×9×9×9").known).toBe(true);
  });

  it("uses flanges up in date order: the first drums get them, later ones are held", () => {
    const row = (rowNo: number, assembleBy: string, drums: number): DrumAssemblyRow => ({ version: "", rowNo, assembleBy, was: null, drumSize: "76×40×36×3", drums, flangesNeeded: drums * 2, flangesFrom: "", prodOrder: "P7-1", partyCable: "A · B", lot: "PL-1", usedOn: assembleBy });
    // 43 flanges at Kharagpur for this size: 20 drums take 40, the next 2 need 4 and only 3 are left.
    expect(heldUp([row(1, "2026-11-21", 2), row(0, "2026-11-20", 20)], stock).map((r) => r.held)).toEqual([false, true]);
  });
});

describe("flange stock the plant has not filled", () => {
  // 54 inch: the stock cell is empty, so nobody knows how many flanges Kharagpur has.
  const unknown = stock.map((x) => (x.drumSize.startsWith("54") ? { ...x, flangesKgp: null } : x));

  it("holds the drums up and asks to confirm the flanges", () => {
    const a = drumAssemblyCard(parseDrumAssembly(fixture("drum-assembly")), unknown, "2026-11-17");
    expect(a.rows.find((r) => r.size.text === "54×24×32×3")).toMatchObject({ held: true, flangesFrom: "To confirm" });
    expect(a.cannot.find((c) => c.size === "54×24×32×3")).toEqual({ size: "54×24×32×3", known: true, drums: 8, problem: "54×24×32×3 flanges to confirm", todo: "Confirm flanges" });
  });

  it("asks for the stock on the requirement card and marks the size", () => {
    const r = drumRequirementCard(parseDrumNeed(fixture("fg-drum-need")), unknown, "2026-11-17");
    expect(r.needsAction.find((n) => n.size === "54×24×32×3")).toMatchObject({ problem: "8 drums to be made need 16 flanges. Kharagpur has only 0", todo: "Confirm 54×24×32×3 flanges" });
    expect(r.bySize.find((x) => x.size === "54×24×32×3")).toMatchObject({ flangesKgp: 0, flangesShort: true });
  });

  it("finds the stock when the card writes the size with a note and the stock sheet without", () => {
    const plain = stock.map((x) => (x.drumSize.startsWith("60") ? { ...x, drumSize: "60 X 30 X 32 X 3", sizeKey: "60x30x32x3" } : x));
    const a = drumAssemblyCard(parseDrumAssembly(fixture("drum-assembly")), plain, "2026-11-17");
    expect(a.rows.find((r) => r.size.text.startsWith("60"))).toMatchObject({ held: false, flangesFrom: "Kharagpur stock" });
  });
});

describe("drum requirement card", () => {
  const r = drumRequirementCard(parseDrumNeed(fixture("fg-drum-need")), stock, "2026-11-17");

  it("totals drums needed, in stock and to be made", () => {
    expect(r.facts).toEqual({ period: "Drums to be ready from 17 Nov to 1 Dec 2026", needed: 282, inStock: 77, toMake: 205, flanges: 410 });
    expect(r.total).toEqual({ needed: 282, inStock: 77, toMake: 205, flanges: 410 });
    expect(r.lateLine).toBe("Already late (needed before 17 Nov): 54 drums, 29 of them still to be made");
  });

  it("colours each day by whether stock covers it", () => {
    expect(inCard(r.calendar).map((c) => [c.n, c.text])).toEqual([
      [29, "all in stock"], [9, "all in stock"], [19, "6 to make"], [9, "9 to make"], [10, "10 to make"], [13, "13 to make"],
      [23, "23 to make"], [19, "19 to make"], [18, "17 to make"], [20, "20 to make"], [27, "27 to make"], [25, "25 to make"], [3, "3 to make"],
      [1, "1 to make"], [3, "3 to make"],
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
      ["Size not known", 41, 0, 41, 82, null, false],
      ["36×14×23×2", 3, 0, 3, 6, 2, true],
    ]);
  });

  it("lists what needs action: late drums, flange shortages, sizes not given", () => {
    expect(r.needsAction.map((n) => [n.size, n.problem, n.todo])).toEqual([
      ["84×35×38×3 + extra segment", "19 drums should already be ready (needed before 17 Nov) and are not in stock", "Drum team to assemble these first"],
      ["60×30×32×3 (250 m packing)", "2 drums should already be ready (needed before 17 Nov) and are not in stock", "Drum team to assemble these first"],
      ["76×40×36×3", "8 drums should already be ready (needed before 17 Nov) and are not in stock", "Drum team to assemble these first"],
      ["84×35×38×3 + extra segment", "55 drums to be made need 110 flanges. Kharagpur has only 0", "Buy 84″ flanges, or decide another drum size"],
      ["70×35×38×3", "1 drum to be made needs 2 flanges. Kharagpur has only 0", "Buy 2 flanges, or use a complete 70″ drum from the yard"],
      ["36×14×23×2", "3 drums to be made need 6 flanges. Kharagpur has only 2", "Shift 36″ flanges from Poly Park (1,080 there)"],
      ["Size not known", "41 drums for 9 orders have no drum size: P726Y-00187 G.R. Infra, P726Y-00208 Laser, P726Y-00209 Laser, P726Y-00229 G.R. Infra, P726Y-00231 G.R. Infra, P726Y-00234 G.R. Infra, P726Y-00277 Laser, P726Y-00279 Laser, P726Y-00280 Laser", "Plant to give the drum size for each order"],
    ]);
  });

  it("lists drums date by date, late ones first", () => {
    expect(r.rows[0]).toMatchObject({ first: true, late: true, needed: 9, fromStock: 5, toMake: 4, orderLot: "P726Y-00267 · PL-001", usedOn: "Outer sheath, 17 Nov", remark: "" });
    expect(r.rows[4]).toMatchObject({ first: false, late: true, usedOn: "Skip 10, 17 Nov", remark: "Bare conductor – wound straight on this drum" });
    expect(r.rows[5].remark).toBe("10 drums on 76″ + 1 on 70″");
    expect(r.rows[6]).toMatchObject({ first: true, late: false, readyBy: "17 Nov", needed: 20 });
    expect(r.rows.find((x) => !x.size.known)).toMatchObject({ remark: "Plant to give the drum size", remarkAttention: true });
  });
});
