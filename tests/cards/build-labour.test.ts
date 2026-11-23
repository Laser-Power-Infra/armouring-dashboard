import { describe, expect, it } from "vitest";
import { allocateLabour, rosterDates, type LabourGrids } from "../../lib/cards/build-labour";
import type { PlanRow } from "../../lib/cards/sheet";

const D0 = "2026-11-28"; // a Saturday
const serial = (day: string) => (Date.parse(day) - Date.UTC(1899, 11, 30)) / 86_400_000;

// Days run (S4 M) sets the fill order, highest first.
const machines = (daysRun = true) =>
  [
    ["Machine", "ERP code", "Machine type", "Must run daily", "Shifts per day", "Men per shift (you fill)", "Days run (last 25 working days)"],
    ["Skip Machine No 8", "SK008", "Skip", true, 2, 2, 20],
    ["Skip Machine No 10", "SK010", "Skip", true, 2, 2, 22],
    ["Wire Drawing No 17", "WD017", "Wire drawing", true, 1, 1, 18],
    ["Skip Machine No 11", "SK011", "Skip", true, 2, "", 10],
    ["Extruder No 22", "EX022", "Extruder", true, 2, 2, ""],
    ["Rewinding No 22", "RW022", "Rewinding", false, 2, 2, 25],
  ].map((r) => (daysRun ? r : r.slice(0, 6)));

// Headings as the guide names them; cells D / N / OFF per date.
const roster = [
  ["Machine type", "Team (operator)", "Role", "Emp code", " Name ", "Main machine", "Sat 28", "Sun 29", "Mon 30", "Tue 1"],
  ["Skip", "Old", "Operator", 2, "Old Binod", "SK8", "D", "D", "D", "D"],
  ["Skip", "Anil", "Operator", 1, "Anil", "SK8", "D", "D", "D", "OFF"],
  ["Skip", "Binod", "Operator", 2, "Binod", "SK10", "Day", "OFF", "D", "OFF"],
  ["Skip", "Anil", "Helper", 3, "Chitta", "SK8", "D", "D", "D", "D"],
  ["Skip", "pool", "Helper", 4, "Dipak", "", "D", "D", "D", "D"],
  ["Extruder", "pool", "Helper", 5, "Eshan", "", "D", "D", "D", "D"],
  ["Skip", "Farid", "Operator", 6, "Farid", "SK11", "D", "D", "D", "OFF"],
  ["Wire Drawing", "pool", "Helper", 7, "Gopal", "WD17", "D", "D", "D", "D"],
  ["Skip", "Hari", "Operator", 8, "Hari", "SK10", "N", "N", "OFF", "N"],
  ["Skip", "pool", "Helper", 9, "Imran", "", "D", "D", "D", "D"],
  ["Stores", "pool", "Helper", 10, "Jatin", "", "D", "D", "D", "D"],
  ["Extruder", "Kamal", "Operator", 11, "Kamal", "", "OFF", "OFF", "OFF", "D"],
  ["Extruder", "Lalit", "Operator", 12, "Lalit", "", "OFF", "OFF", "D", "D"],
  ["Multi Strand", "Mohan", "Operator", 13, "Mohan", "", "OFF", "OFF", "OFF", "D"],
  ["", "", "", "", "", "", "", "", "", ""],
];
const skill = [
  ["Sl", "Emp code", "Name", "Dept", "Desig", "Machine (ERP cost code)", "Skill level"],
  [1, 1, "Anil", "", "", "SK008", "Skilled"],
  [2, 7, "Gopal", "", "", "", "Skilled"],
  [3, 5, "Eshan", "", "", "RW022", "Semi-skilled"],
];
const blocked = [["Sl", "Code", "Name"], [1, 9, "Imran"]];
const grids = (over: Partial<LabourGrids> = {}): LabourGrids => ({ machines: machines(), roster, rosterName: "KGP-ROS-01 Rev 6", skill, blocked, ...over });

const job = (day: string, machine: string, qty = 5) => ({ day, machine, qty }) as PlanRow;
const plan = [
  job("2026-11-28", "Skip 8"), job("2026-11-28", "Skip 10"), job("2026-11-28", "Skip 11"),
  job("2026-11-29", "Skip 8"), job("2026-11-29", "Skip 10"),
  job("2026-11-30", "Extruder 22"), job("2026-11-30", "Skip 10", 0),
  job("2026-12-01", "Skip 8"), job("2026-12-01", "Extruder 22"),
  job("2026-12-02", "Skip 8"),
];

describe("roster date headings", () => {
  it("resolves weekday and day number near day 0, across a month end", () => {
    expect(rosterDates(roster[0], D0).map((d) => d.day)).toEqual(["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(rosterDates(roster[0], D0)[0].col).toBe(6);
  });
  it("takes a roster that started before day 0, serial numbers and typed dates", () => {
    expect(rosterDates(["Name", "Sat 21", "Sun 22"], "2026-11-23").map((d) => d.day)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(rosterDates(["Name", serial("2026-11-30"), "Tue 1", "02-Dec-26", "Thursday 3", "Remarks"], D0).map((d) => d.day)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03"]);
  });
  it("refuses a heading that fits no date", () => {
    expect(() => rosterDates(["Mon 28"], D0)).not.toThrow(); // 28 Dec 2026 is a Monday
    expect(() => rosterDates(["Sat 28", "Sat 29"], D0)).toThrow(/Sat 29/);
  });
});

describe("placing men (guide 4.1)", () => {
  const out = allocateLabour(plan, grids(), D0);
  const rows = (day: string, shift: string) => out.labour.filter((r) => r.day === day && r.shift === shift);
  const at = (day: string, shift: string, machine: string) => rows(day, shift).find((r) => r.machine === machine);

  it("ends the period with the roster and gives spare-men rows for every date and shift", () => {
    expect(out.rosterEnds).toBe("2026-12-01");
    expect(out.spare.map((s) => `${s.day} ${s.shift}`)).toEqual(["28", "29", "30", "01"].flatMap((d) => [`2026-${d === "01" ? 12 : 11}-${d} Day`, `2026-${d === "01" ? 12 : 11}-${d} Night`]));
    expect(out.labour.every((r) => r.day <= "2026-12-01")).toBe(true);
    expect(out.labour.map((r) => r.rowNo)).toEqual(out.labour.map((_, i) => i));
    expect(allocateLabour(plan, grids({ roster: roster.map((r) => [...r, ...Array(20).fill("D")]).map((r, i) => (i ? r : [...roster[0], ...Array.from({ length: 20 }, (_, k) => serial("2026-12-02") + k)])) }), D0).spare).toHaveLength(28);
  });

  it("fills machines with the most days run first; equal days run in S4 row order", () => {
    const tied = machines().map((r, i) => (i === 2 ? [...r.slice(0, 6), 20] : r)); // Skip 10 now ties with Skip 8, which is the row above it
    const day = allocateLabour(plan, grids({ machines: tied }), D0).labour.filter((r) => r.day === "2026-11-28" && r.shift === "Day");
    expect(day.map((r) => r.machine)).toEqual(["Skip 8", "Skip 10", "WD17", "Skip 11", "WD14"]);
  });

  it("fills machines in fill order, home machine first, helpers by rank", () => {
    expect(rows("2026-11-28", "Day").map((r) => r.machine)).toEqual(["Skip 10", "Skip 8", "WD17", "Skip 11", "WD14"]); // WD14 runs with Skip 10 and has no S4 row here
    // Binod's main machine is Skip 10; Dipak is the pool helper of the section.
    expect(at("2026-11-28", "Day", "Skip 10")).toMatchObject({ operator: "Binod", helpers: ["Dipak"], menNeeded: 2, menGiven: 2, note: null });
    // Anil's home machine (skill sheet ERP code = S4 ERP code); Chitta is of his team.
    expect(at("2026-11-28", "Day", "Skip 8")).toMatchObject({ operator: "Anil", helpers: ["Chitta"], note: null });
    expect(at("2026-11-28", "Day", "WD17")).toMatchObject({ operator: "Gopal", helpers: [], menNeeded: 1, menGiven: 1, note: "skilled helper acting as operator – to confirm" });
  });

  it("stores a row without men when men per shift is not set", () => {
    expect(at("2026-11-28", "Day", "Skip 11")).toMatchObject({ operator: null, helpers: [], menNeeded: 0, menGiven: 0, note: "Men per shift not set" });
  });

  it("skips a day-only machine at night and leaves a shift without an operator", () => {
    expect(rows("2026-11-28", "Night").map((r) => r.machine)).toEqual(["Skip 10", "Skip 8", "Skip 11", "WD14"]);
    expect(at("2026-11-28", "Night", "Skip 10")).toMatchObject({ operator: "Hari", helpers: [], menNeeded: 2, menGiven: 1 });
    expect(at("2026-11-28", "Night", "Skip 8")).toMatchObject({ operator: null, menGiven: 0, note: null });
  });

  it("keeps a man for his own machine while it has no operator (−8)", () => {
    // Binod is off. Without the rule Anil (A–Z) would go to Skip 10, the first machine filled.
    expect(at("2026-11-29", "Day", "Skip 10")).toMatchObject({ operator: "Farid", note: "his usual machine: SK11" });
    expect(at("2026-11-29", "Day", "Skip 8")).toMatchObject({ operator: "Anil" });
  });

  it("works only on dates with plan quantity; a machine without days run comes last; the last operator stays", () => {
    expect(rows("2026-11-30", "Day").map((r) => r.machine)).toEqual(["Extruder 22"]);
    expect(at("2026-11-30", "Day", "Extruder 22")).toMatchObject({ operator: "Lalit", helpers: ["Eshan"] });
    expect(rows("2026-12-01", "Day").map((r) => r.machine)).toEqual(["Skip 8", "WD17", "Extruder 22"]);
    // Kamal comes before Lalit A–Z; Lalit ran it on its previous working date (+5).
    expect(at("2026-12-01", "Day", "Extruder 22")).toMatchObject({ operator: "Lalit" });
    expect(at("2026-12-01", "Day", "Skip 8")).toMatchObject({ operator: "Mohan", helpers: ["Chitta"], note: "Multi Strand operator – to confirm" });
  });

  it("lists the men without a machine A–Z, operators marked, blocked and other sections left out", () => {
    expect(out.spare.find((s) => s.day === "2026-11-28" && s.shift === "Day")!.men).toEqual(["Eshan", "Farid (op)"]);
    expect(out.spare.find((s) => s.day === "2026-11-30" && s.shift === "Day")!.men).toEqual(["Anil (op)", "Binod (op)", "Chitta", "Dipak", "Farid (op)", "Gopal"]);
    expect(JSON.stringify(out)).not.toMatch(/Imran|Jatin|Old Binod/);
  });

  it("says what is missing", () => {
    expect(out.warning).toBe("Days run is not set in KHG Machines to Run Daily for Extruder 22, so it was given men last");
    expect(() => allocateLabour(plan, grids({ machines: machines(false) }), D0)).toThrow(/“Days run” not found/);
    expect(() => allocateLabour(plan, grids({ skill: skill.map((r) => r.slice(0, 6)) }), D0)).toThrow(/Skill sheet.*“Skill level” not found/);
    expect(() => allocateLabour(plan, grids({ roster: roster.map((r) => r.slice(0, 6)) }), D0)).toThrow(/no date columns/);
    expect(() => allocateLabour(plan, grids(), "2026-12-05")).toThrow(/ends 1 Dec, before this card starts/);
  });
});
