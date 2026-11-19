import { describe, expect, it } from "vitest";
import { weeks } from "../../lib/cards/calendar";
import { productionCards, type MachineCard } from "../../lib/cards/production";
import { parseCardPlan } from "../../lib/cards/sheet";
import { fixture } from "./testdb";

// Expected figures are those printed on templates/Machine_Production_Cards_New_Layout.html, made from the same plan.
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
      "Laying 5": [15, "69.7 km", "Normal"],
      "Armouring 5": [15, "53.8 km", "Normal"],
      "Extruder 22": [14, "179.1 core km", "Normal"],
      "Extruder 35": [9, "67.8 core km", "Normal"],
      "Extruder 51": [0, "–", "No work"],
      "Extruder 52": [15, "128.6 km", "Slowest step"],
      "Sioplas 4": [15, "88.2 core km + 84.6 km", "Normal"],
    });
    expect(machine("Skip (12+7)-1").load).toMatchObject({ text: "Low – works only 3 of 15 days", attention: true });
  });

  // 28 Nov: 2.66 + 0.58 + 0.71 = 3.95 is printed as 3.9 on the issued card, like the four other halfway days of this plan.
  it("colours the Armouring 5 calendar and marks strip changes", () => {
    expect(dayCells(machine("Armouring 5"))).toEqual([
      ["17", "1.0", false], ["18", "5.0", false], ["19", "4.0", true], ["20", "1.3", false], ["21", "2.0", false], ["22", "7.8", true],
      ["23", "7.0", false], ["24", "5.9", false], ["25", "2.0", false], ["26", "1.0", false], ["27", "4.1", true], ["28", "3.9", true], ["29", "5.1", true],
      ["30", "3.6", false], ["1 Dec", "0.1", false],
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

  it("flags drum lines, waiting lines and jobs Extruder 51 could take", () => {
    const drum = machine("Skip 10").jobs.find((j) => j.status === "drum")!;
    expect(drum).toMatchObject({ date: "20 Nov", feed: "Aluminium rod drawn on WD17", drums: "Drums: needs 10 drums of 48×20×28×2.25 RDSO from the yard that day – run only if assembled the day before" });
    const wait = machine("Skip 8").jobs.find((j) => j.status === "wait")!;
    expect(wait).toMatchObject({ qty: "–", material: "–", job: "ACSR Raccoon – waiting for drums", jobAttention: null });
    expect(wait.feed).toMatch(/^Waiting for drums – run Raccoon here only when/);
    // 28 Nov has other work on Skip 8, so it is a working day. A day with only the waiting line says so.
    expect(dayCells(machine("Skip 8")).find(([label]) => label === "28")).toEqual(["28", "5.9", false]);
    const onlyWaiting = productionCards(parseCardPlan(fixture("card-plan")).filter((r) => r.machine !== "Skip 8" || r.feedStatus === "wait" || r.day !== "2026-11-28"));
    expect(dayCells(onlyWaiting.machines.find((m) => m.name === "Skip 8")!).find(([label]) => label === "28")).toEqual(["28", "waiting for drums", false]);
    expect(machine("Extruder 52").jobs[0]).toMatchObject({ order: "P726Y-00265", ext51: true, core: "INNER sheath" });
    expect(machine("Extruder 52").jobs[1]).toMatchObject({ order: "P726Y-00267", ext51: false });
  });
});
