import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseCardPlan,
  parseDay,
  parseDrumAssembly,
  parseDrumNeed,
  parseDrumStock,
  parseLabour,
  parseSpareMen,
  parseVersion,
  sizeKey,
} from "../../lib/cards/sheet";

// The six tabs as read from the sheet on 19-Nov-26 (version "17-Nov R2 plan").
export const fixture = (name: string): unknown[][] => JSON.parse(readFileSync(`tests/fixtures/cards/${name}.json`, "utf8"));

describe("card sheet parsing", () => {
  it("reads a day as text, with a late mark, or as a Sheets serial number", () => {
    expect(parseDay("17-Nov-26")).toEqual({ day: "2026-11-17", late: false, was: null });
    expect(parseDay("13-Nov-26 (LATE)")).toEqual({ day: "2026-11-13", late: true, was: null });
    expect(parseDay("17-Nov-26 (LATE – was 13-Nov-26)")).toEqual({ day: "2026-11-17", late: true, was: "2026-11-13" });
    expect(parseDay(46343).day).toBe("2026-11-17");
    expect(() => parseDay("soon")).toThrow(/soon/);
  });

  it("matches a drum size however it is typed", () => {
    expect(sizeKey("84 X 35 X 38 X 3 + EXTRA SEGMENT")).toBe(sizeKey("84×35×38×3 + extra segment"));
    expect(sizeKey("48 X 20 X 28 X 2.25 - RDSO")).toBe(sizeKey("48×20×28×2.25 RDSO"));
  });

  it("reads the version text", () => {
    expect(parseVersion("17-Nov R2 plan", "2026-11-17")).toEqual({ issueDate: "2026-11-17", rev: 2 });
    expect(parseVersion("VERSION 20-Nov-26 / Rev 6", "2026-11-20")).toEqual({ issueDate: "2026-11-20", rev: 6 });
    expect(parseVersion("draft", "2026-11-20")).toEqual({ issueDate: "2026-11-20", rev: null });
  });

  it("reads every tab of the issued cards", () => {
    const plan = parseCardPlan(fixture("card-plan"));
    expect(plan).toHaveLength(271);
    expect(plan.filter((r) => r.qty > 0)).toHaveLength(270);
    expect(plan.filter((r) => r.feedStatus === "drum")).toHaveLength(10);
    expect(plan[0]).toMatchObject({ version: "17-Nov R2 plan", day: "2026-11-18", machine: "Skip (12+7)-1", prodOrder: "P726Y-00277", qty: 10, unit: "core km", rowNo: 0 });
    const labour = parseLabour(fixture("labour-allocation"));
    expect(labour).toHaveLength(282);
    expect(labour[0]).toMatchObject({ day: "2026-11-18", shift: "Day", machine: "WD14", operator: "Palash Kumar Santra", helpers: ["Amar Sen"], menNeeded: 2, menGiven: 2, note: null });
    const spare = parseSpareMen(fixture("spare-men"));
    expect(spare).toHaveLength(28);
    expect(spare[0].men).toHaveLength(30);
    const need = parseDrumNeed(fixture("fg-drum-need"));
    expect(need).toHaveLength(42);
    expect(need[0]).toMatchObject({ usedOn: "2026-11-17", readyBy: "2026-11-13", late: true, drumsNeeded: 9, fromStock: 5, toAssemble: 4 });
    const assembly = parseDrumAssembly(fixture("drum-assembly"));
    expect(assembly).toHaveLength(36);
    expect(assembly[0]).toMatchObject({ assembleBy: "2026-11-17", was: "2026-11-13", drums: 4, flangesNeeded: 8, usedOn: "2026-11-17" });
    const stock = parseDrumStock(fixture("drum-stock"));
    expect(stock).toHaveLength(10);
    expect(stock.find((s) => s.sizeKey === sizeKey("60×30×32×3 (250 m packing)"))).toMatchObject({ drums: 8, flangesKgp: 330, flangesPp: 186 });
    expect(stock.find((s) => s.sizeKey === sizeKey("70×35×38×3"))).toMatchObject({ drums: null, flangesKgp: 0 });
    expect(stock.find((s) => s.sizeKey === sizeKey("43 X 15 X 23 X 2.25"))).toMatchObject({ flangesKgp: null });
  });

  it("gives the same rows when columns move and a new one is added", () => {
    const tab = fixture("card-plan");
    const order = tab[0].map((_, i) => i).reverse();
    const moved = tab.map((r, n) => [n === 0 ? "New column" : "x", ...order.map((i) => r[i])]);
    expect(parseCardPlan(moved)).toEqual(parseCardPlan(tab));
  });

  it("refuses a machine it does not know, by name", () => {
    const tab = fixture("card-plan").map((r) => [...r]);
    tab[5][3] = "Skip 99";
    expect(() => parseCardPlan(tab)).toThrow(/Skip 99/);
  });
});
