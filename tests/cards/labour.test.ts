import { describe, expect, it } from "vitest";
import { labourCard } from "../../lib/cards/labour";
import { parseLabour, parseSpareMen } from "../../lib/cards/sheet";
import { fixture } from "./testdb";

// Expected figures are those printed on templates/Labour_Allocation_Card_New_Layout.html, made from the same allocation.
describe("labour allocation card", () => {
  const c = labourCard(parseLabour(fixture("labour-allocation")), parseSpareMen(fixture("spare-men")), "2026-11-17");
  const page = (day: string) => c.days.find((d) => d.day === day)!;

  it("counts machine-shifts, operators, full teams and lines needing action", () => {
    expect(c.facts).toEqual({ period: "17 to 30 Nov 2026 (14 days)", toFill: 282, withOperator: 281, fullTeam: 278, needingAction: 15 });
  });

  it("shows men named of men needed per day; a day short of men or without an operator is not ok", () => {
    expect(c.calendar.flat().filter((x) => x.index !== null).map((x) => [x.got, x.need, x.ok])).toEqual([
      [43, 43, true], [65, 65, false], [65, 65, true], [73, 73, true], [63, 63, true], [58, 59, false],
      [59, 59, true], [59, 59, true], [61, 61, true], [71, 71, true], [63, 63, true], [65, 65, true], [63, 65, false],
      [66, 66, true],
    ]);
  });

  it("lists what needs action by date, day shift first, then machine order", () => {
    expect(c.needsAction.map((r) => `${r.date} ${r.shift} ${r.machine}`)).toEqual([
      "Wed 18 Nov Night Extruder 35", "Thu 19 Nov Day Sioplas 4", "Fri 20 Nov Day Skip (12+7)-2", "Fri 20 Nov Night Skip (12+7)-1", "Fri 20 Nov Night Skip (12+7)-2",
      "Fri 20 Nov Night Extruder 35", "Sat 21 Nov Night Skip (12+7)-2", "Sun 22 Nov Day WD14", "Fri 27 Nov Day Skip (12+7)-2", "Fri 27 Nov Day Skip 11",
      "Fri 27 Nov Night Skip 11", "Sat 28 Nov Day Skip 11", "Sun 29 Nov Day Skip 10", "Sun 29 Nov Night Skip (12+7)-2", "Sun 29 Nov Night Skip 11",
    ]);
    expect(c.needsAction[0]).toMatchObject({ problem: "No experienced operator for this machine", todo: "Plant to name an operator" });
    expect(c.needsAction[1]).toMatchObject({ problem: "Sanjib Mandal (Extruder operator) is not the usual operator of this machine", todo: "Plant to confirm he can run it" });
    expect(c.needsAction[7]).toMatchObject({ problem: "1 man short", todo: "Plant to give 1 more man" });
  });

  it("gives one page per date with who is on which machine", () => {
    expect(c.days).toHaveLength(14);
    const d17 = page("2026-11-17");
    expect(d17.title).toBe("Tuesday 17 November");
    expect(d17.machines.map((m) => m.name)).toEqual(["WD17", "Skip 10", "Laying 5", "Armouring 5", "Extruder 35", "Extruder 52", "Sioplas 4"]);
    expect(d17.machines[0]).toEqual({ name: "WD17", day: { men: "1 of 1", bad: false, notSet: false, operator: "Sankar Bangal", usual: null, confirm: null, helpers: "–" }, night: null });
    expect(d17.machines[2].night).toMatchObject({ operator: "Dolan Ghosh", usual: "RW22", confirm: null, helpers: "Arun Jaiswal" });
    // Guide v4, 4.3: every machine of the 21-machine table without a row that date.
    expect(d17.noJob).toBe("WD14, Skip (12+7)-1, Skip (12+7)-2, Skip 8, Skip 11, Buncher 4, MS-14, MS-11, MS-18, Laying 7, Extruder 22, Extruder 51, Sioplas 3, Boiler 7");
    expect(d17.spare.map((s) => [s.shift, s.count, s.operators.split(", ").length])).toEqual([["Day", 30, 11], ["Night", 18, 8]]);
    expect(d17.spare[0].operators.startsWith("Anupam Das, Chandan Jana")).toBe(true);
  });

  it("marks a shift with no operator, a short shift and an operator to confirm", () => {
    const ext35 = page("2026-11-18").machines.find((m) => m.name === "Extruder 35")!;
    expect(ext35.night).toMatchObject({ men: "3 of 3", bad: true, operator: null });
    expect(page("2026-11-22").machines.find((m) => m.name === "WD14")!.day).toMatchObject({ men: "1 of 2", bad: true });
    expect(page("2026-11-19").machines.find((m) => m.name === "Sioplas 4")!.day).toMatchObject({ operator: "Sanjib Mandal", confirm: "Extruder operator", usual: null, bad: false });
  });
});

// Rows as the app's own build stores them (guide v4): the period ends with the roster, notes in the v4 wording.
describe("labour allocation card built in the app", () => {
  const row = (day: string, shift: "Day" | "Night", machine: string, operator: string | null, helpers: string[], menNeeded: number, note: string | null = null) =>
    ({ version: "", rowNo: 0, day, shift, machine, operator, helpers, menNeeded, menGiven: (operator ? 1 : 0) + helpers.length, note });
  const spare = ["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"].flatMap((day) => (["Day", "Night"] as const).map((shift) => ({ version: "", day, shift, men: [] as string[] })));
  const c = labourCard(
    [
      row("2026-11-28", "Night", "Skip 8", "Asha", ["Bimal"], 2, "his usual machine: SK10"),
      row("2026-11-28", "Day", "Skip 8", "Chand", [], 4, "skilled helper acting as operator – to confirm"),
      row("2026-11-28", "Day", "Skip (12+7)-1", null, [], 0, "Men per shift not set"),
      row("2026-11-29", "Day", "Skip (12+7)-1", null, [], 0, "Men per shift not set"),
      row("2026-11-29", "Day", "Sioplas 4", "Dev", [], 1, "his usual machine: Rewinding No 22"),
    ],
    spare,
    "2026-11-28",
  );

  it("ends the period on the last date that has spare-men rows", () => {
    expect(c.facts.period).toBe("28 Nov to 1 Dec 2026 (4 days)");
    expect(c.days.map((d) => d.day)).toEqual(["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(c.calendar.flat().filter((x) => x.index !== null)).toHaveLength(4);
  });

  it("keeps a machine without men per shift out of the counts and lists it once under needs action", () => {
    expect(c.facts).toMatchObject({ toFill: 3, withOperator: 3, fullTeam: 2, needingAction: 3 });
    expect(c.calendar.flat().filter((x) => x.index !== null).map((x) => [x.got, x.need, x.ok])).toEqual([[3, 6, false], [1, 1, false], [0, 0, true], [0, 0, true]]);
    expect(c.needsAction).toEqual([
      { date: "Sat 28 Nov", shift: "Day", machine: "Skip 8", problem: "3 man short", todo: "Plant to give 3 more man" },
      { date: "Sat 28 Nov", shift: "Day", machine: "Skip 8", problem: "Chand (skilled helper acting as operator) is not the usual operator of this machine", todo: "Plant to confirm he can run it" },
      { date: "–", shift: "–", machine: "Skip (12+7)-1", problem: "Men per shift not set", todo: "Fill men per shift in KHG Machines to Run Daily" },
    ]);
    expect(c.days[0].machines[0]).toEqual({ name: "Skip (12+7)-1", day: { men: "–", bad: true, notSet: true, operator: null, usual: null, confirm: null, helpers: "–" }, night: null });
  });

  it("prints the usual machine of a v4 note once, also when it is a name with spaces", () => {
    expect(c.days[0].machines[1].night).toMatchObject({ operator: "Asha", usual: "SK10", confirm: null });
    expect(c.days[1].machines[1].day).toMatchObject({ usual: "Rewinding No 22" });
    expect(c.days[2].noJob.split(", ")).toHaveLength(21);
  });
});
