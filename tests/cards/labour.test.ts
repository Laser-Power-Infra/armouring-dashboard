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
    expect(d17.machines[0]).toEqual({ name: "WD17", day: { men: "1 of 1", bad: false, operator: "Sankar Bangal", usual: null, confirm: null, helpers: "–" }, night: null });
    expect(d17.machines[2].night).toMatchObject({ operator: "Dolan Ghosh", usual: "RW22", confirm: null, helpers: "Arun Jaiswal" });
    expect(d17.noJob).toBe("WD14, Skip (12+7)-1, Skip (12+7)-2, Skip 8, Skip 11, MS-14, MS-11, MS-18, Extruder 22");
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
