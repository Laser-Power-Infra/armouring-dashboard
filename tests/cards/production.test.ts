import { describe, expect, it } from "vitest";
import { weeks } from "../../lib/cards/calendar";
import { productionCards, type MachineCard } from "../../lib/cards/production";
import { parseCardPlan } from "../../lib/cards/sheet";
import { fixture } from "./testdb";

// The rows are the 17-Nov plan as issued; the rules are those of docs/final guide for card 1.md, section 5.
const dayCells = (m: MachineCard) => m.calendar.flat().filter((c) => c.index !== null).map((c) => [c.label, c.big ?? c.small, !!c.dot]);

describe("machine production cards", () => {
  const c = productionCards(parseCardPlan(fixture("card-plan")));
  const machine = (name: string) => c.machines.find((m) => m.name === name)!;

  it("builds Monday-to-Sunday weeks and names the month on the 1st", () => {
    const w = weeks("2026-11-17", 15);
    expect(w).toHaveLength(3);
    expect(w[0][0]).toMatchObject({ day: "2026-11-16", label: "16", index: null });
    expect(w[0][1]).toMatchObject({ label: "17", index: 0 });
    expect(w[2][1]).toMatchObject({ label: "1 Dec", index: 14 });
    expect(w[2][6]).toMatchObject({ label: "6", index: null });
  });

  it("gives the cover its counts", () => {
    expect(c.d0).toBe("2026-11-17");
    expect(c.period).toBe("17 Nov to 1 Dec 2026 (15 days)");
    expect(c.cover).toEqual({ jobLines: 270, feedReady: 260, feedMissing: 0, needDrums: 10 });
  });

  it("gives every machine its working days, planned quantity and load", () => {
    expect(Object.fromEntries(c.machines.map((m) => [m.name, [m.workingDays.size, m.planned, m.load.short]]))).toEqual({
      WD14: [14, "–", "Normal"],
      WD17: [13, "–", "Normal"],
      "Skip (12+7)-1": [3, "29.5 core km", "Low"],
      "Skip (12+7)-2": [6, "26.0 core km", "Normal"],
      "Skip 8": [8, "98.6 core km", "Normal"],
      "Skip 10": [13, "295.0 km", "Normal"],
      "Skip 11": [7, "114.6 km", "Normal"],
      "MS-14": [4, "40.0 core km", "Normal"],
      "MS-11": [7, "58.6 core km", "Normal"],
      "MS-18": [7, "98.7 km", "Normal"],
      "Laying 5": [15, "69.7 km", "Slowest step"],
      "Armouring 5": [15, "53.8 km", "Normal"],
      "Extruder 22": [14, "179.1 core km", "Normal"],
      "Extruder 35": [9, "67.8 core km", "Normal"],
      "Extruder 51": [0, "–", "No work"],
      "Extruder 52": [15, "128.6 km", "Normal"],
      "Sioplas 4": [15, "88.2 core km + 84.6 km", "Normal"],
    });
    expect(machine("Skip (12+7)-1").load).toMatchObject({ text: "Low – works only 3 of 15 days", attention: true });
  });

  // 28 Nov: 2.66 + 0.58 + 0.71 = 3.95, printed to one decimal as 4.0.
  it("colours the Armouring 5 calendar and marks strip changes", () => {
    expect(dayCells(machine("Armouring 5"))).toEqual([
      ["17", "1.0", false], ["18", "5.0", false], ["19", "4.0", true], ["20", "1.3", false], ["21", "2.0", false], ["22", "7.8", true],
      ["23", "7.0", false], ["24", "5.9", false], ["25", "2.0", false], ["26", "1.0", false], ["27", "4.1", true], ["28", "4.0", true], ["29", "5.1", true],
      ["30", "3.7", false], ["1 Dec", "0.1", false],
    ]);
  });

  it("runs wire drawing on the days the machines it feeds run", () => {
    expect(dayCells(machine("WD14")).slice(0, 2)).toEqual([["17", "off", false], ["18", "runs", false]]);
    expect(machine("WD14").jobs).toEqual([]);
  });

  it("lists jobs day by day", () => {
    const arm = machine("Armouring 5").jobs;
    expect(arm[0]).toMatchObject({ first: true, date: "17 Nov", order: "P726Y-00267", mc: "SP26Y-00188", job: "Strip 4×0.80", jobAttention: null, core: "–", qty: "1.00 km", feed: "Inner-sheathed cable: ready in stock (1.0)" });
    expect(arm[2]).toMatchObject({ date: "19 Nov", order: "P726Y-00208", job: "Strip 4×0.60", jobAttention: "strip change", qty: "4.01 km" });
    expect(arm[4]).toMatchObject({ first: false, date: "20 Nov", order: "P726Y-00208" });
  });

  it("asks for drums on a line with status drum: one drum per 2.5 km", () => {
    const drum = machine("Skip 10").jobs.find((j) => j.status === "drum")!;
    expect(drum).toMatchObject({ date: "20 Nov", qty: "23.00 km", drums: "Drums: needs 10 drums of 48×20×28×2.25 RDSO – run only if assembled the day before" });
    expect(machine("Skip 10").jobs.find((j) => j.status === "ok")!.drums).toBeNull();
  });

  it("totals the raw material per machine and for all machines", () => {
    const skip = machine("Skip (12+7)-1").rm;
    expect(skip.names).toEqual(["Aluminium rod"]);
    expect(skip.days[0]).toEqual({ date: "18 Nov", kg: [2568] });
    expect(skip.total[0]).toBe(skip.days.reduce((s, d) => s + d.kg[0], 0));
    const i = c.rm.names.indexOf("Aluminium rod");
    expect(c.rm.total[i]).toBe(c.machines.reduce((s, m) => s + (m.rm.total[m.rm.names.indexOf("Aluminium rod")] ?? 0), 0));
    expect(c.takers("Aluminium rod")).toMatch(/^Skip \(12\+7\)-1 \([\d,]+ kg\) · /);
  });
});
