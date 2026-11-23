// Card 2 build: reads the labour sheets and places the men (Card 2 guide v4, sections 1, 3 and 4.1).
// Roster and machine data stay in memory; only the Labour allocation and Spare men rows are stored.
import { batchGet, newestSheetTitled } from "../sheets/client.ts";
import { addDays, dMon } from "./calendar.ts";
import { LABOUR_MACHINES, MEN_NOT_SET } from "./labour.ts";
import { parseDay, type Day, type LabourRow, type PlanRow, type SpareRow } from "./sheet.ts";

type Grid = unknown[][];
/** Every grid starts at its header row. */
export type LabourGrids = { machines: Grid; roster: Grid; rosterName: string; skill: Grid; blocked: Grid };

const S4 = { id: "1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg", name: "KHG Machines to Run Daily", range: "Machines!A6:Z" };
export const S6 = { id: "1PpDwZ5vXyLGDsovbSlOiH3HxCYyQMy2XD5P6tQAfDYU", name: "Skill sheet", range: "'Highlighted (Excel data)'" };
export const S10 = { id: "1ztbcLWLKGBE8WLpVP7RB8ZVJBHdOjRoOqyPPFWRmIik", name: "KGP Punch Blocked List", range: "'Punch Blocked'!A3:Z" };
export const ROSTER_TITLE = "KGP-ROS";
const ROSTER_TAB = "'MACHINE ROSTER (machine name)'";

/** Reads the four sheets; the roster is found by title on every run. One error names every sheet that could not be read. */
export async function readLabourSources(): Promise<LabourGrids> {
  const one = (s: { id: string; name: string; range: string }) =>
    batchGet(s.id, [s.range]).then(
      ([g]) => g,
      (e) => Promise.reject(new Error(`"${s.name}" (${s.id}): ${e?.message ?? e}`)),
    );
  const roster = async () => {
    const f = await newestSheetTitled(ROSTER_TITLE).catch((e) => Promise.reject(new Error(`the roster (search for a sheet titled ${ROSTER_TITLE}): ${e?.message ?? e}`)));
    if (!f) throw new Error(`the roster: no Google Sheet with ${ROSTER_TITLE} in its title is shared`);
    return { name: f.name, grid: await one({ id: f.id, name: f.name, range: ROSTER_TAB }) };
  };
  const [machines, ros, skill, blocked] = await Promise.allSettled([one(S4), roster(), one(S6), one(S10)]);
  const failed = [machines, ros, skill, blocked].flatMap((r, i) => (r.status === "rejected" ? [`${["S4", "S5", "S6", "S10"][i]} ${r.reason?.message ?? r.reason}`] : []));
  if (failed.length || machines.status !== "fulfilled" || ros.status !== "fulfilled" || skill.status !== "fulfilled" || blocked.status !== "fulfilled") {
    throw new Error(`Cannot read ${failed.length} sheet(s) – share them with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Viewer:\n  ${failed.join("\n  ")}`);
  }
  return { machines: machines.value, roster: ros.value.grid, rosterName: ros.value.name, skill: skill.value, blocked: blocked.value };
}

const text = (v: unknown) => String(v ?? "").trim();
/** A heading however it is typed: the words before any bracket, without case, spaces or dots. */
const heading = (v: unknown) => text(v).replace(/\(.*$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** A machine name or code however it is typed. */
const same = (v: unknown) => text(v).replace(/\s+/g, " ").toUpperCase();
const code = (v: unknown) => text(v).replace(/\s+/g, "").toUpperCase();
const num = (v: unknown) => (typeof v === "number" ? v : /^\d+(\.\d+)?$/.test(text(v)) ? Number(text(v)) : null);

/** Column numbers by heading. A missing heading is an error naming the sheet, unless it is optional (then -1). */
function columns<K extends string>(sheet: string, head: unknown[], want: Record<K, string[]>, optional: string[] = []): Record<K, number> {
  const found = head.map(heading);
  const out = {} as Record<K, number>;
  const missing: string[] = [];
  for (const k of Object.keys(want) as K[]) {
    out[k] = found.findIndex((h) => h !== "" && want[k].some((w) => heading(w) === h));
    if (out[k] < 0 && !optional.includes(k)) missing.push(`“${want[k][0]}”`);
  }
  if (missing.length) throw new Error(`${sheet}: heading ${missing.join(", ")} not found. Headings read: ${head.map(text).filter(Boolean).join(" | ") || "none"}`);
  return out;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const utc = (day: Day) => new Date(`${day}T00:00:00Z`);

/**
 * The date columns of the roster. A heading is "Sat 21" (weekday and day number, no month), a typed date ("21-Nov-26")
 * or a Sheets serial number. The first "Sat 21" is the one nearest to day 0; each later one is the next after the column before it.
 */
export function rosterDates(head: unknown[], d0: Day): { col: number; day: Day }[] {
  const out: { col: number; day: Day }[] = [];
  head.forEach((h, col) => {
    if (typeof h === "number") {
      if (h > 40000) out.push({ col, day: parseDay(h).day });
      return;
    }
    const s = text(h);
    if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(s)) return void out.push({ col, day: parseDay(s).day });
    const m = /^([A-Za-z]{3})[A-Za-z]*[.,]?\s*(\d{1,2})$/.exec(s);
    const weekday = m ? WEEKDAYS.indexOf(m[1].toLowerCase()) : -1;
    if (!m || weekday < 0) return;
    const prev = out.at(-1)?.day;
    const tries = prev
      ? Array.from({ length: 62 }, (_, i) => addDays(prev, i + 1))
      : Array.from({ length: 91 }, (_, i) => addDays(d0, i % 2 ? -(i + 1) / 2 : i / 2));
    const day = tries.find((d) => utc(d).getUTCDate() === Number(m[2]) && utc(d).getUTCDay() === weekday);
    if (!day) throw new Error(`Roster: the date heading “${s}” fits no date near ${dMon(prev ?? d0)}`);
    out.push({ col, day });
  });
  return out;
}

// Guide 3.2: section of a man from the roster's "Machine type".
const SECTIONS: [RegExp, string][] = [[/wire\s*drawing/i, "WD"], [/skip/i, "SKIP"], [/multi\s*strand/i, "MST"], [/laying/i, "LAY"], [/armour/i, "ARM"], [/extruder/i, "EXT"], [/sioplas/i, "SIO"], [/boiler|curing/i, "BLR"]];
// Guide 4.1 step 3: the second skill of a section.
const SECOND: Record<string, string> = { MST: "SKIP", SKIP: "MST", SIO: "EXT", EXT: "SIO", LAY: "ARM", BLR: "SIO" };
// Guide 3.4: wire drawing has no jobs of its own.
const WD14_WITH = ["Skip (12+7)-1", "Skip (12+7)-2", "Skip 10", "Buncher 4", "MS-14", "MS-11", "Skip 11", "MS-18"];
const WD17_WITH = ["Skip 8"];

type Man = {
  id: string;
  name: string;
  sectionName: string;
  section: string | null;
  team: string;
  operator: boolean;
  skilledHelper: boolean;
  mainCode: string;
  /** Card machine of his home machine; null when he has none or it is not on the card. */
  home: string | null;
  /** How his home machine prints: its roster code, or its S4 name when it is not on the card. */
  homeLabel: string | null;
  shifts: Map<Day, string>;
};

/** Places the men of the roster on the machines of the Card 1 plan (guide 4.1). No I/O. */
export function allocateLabour(plan: PlanRow[], g: LabourGrids, d0: Day): { labour: LabourRow[]; spare: SpareRow[]; rosterEnds: Day; warning: string | null } {
  // Machines (guide 3.1): the fixed table plus its row of S4.
  const mc = columns(`${S4.name}, tab Machines`, g.machines[0] ?? [], { machine: ["Machine"], erp: ["ERP code"], shifts: ["Shifts per day"], men: ["Men per shift"], daysRun: ["Days run"] });
  const s4Rows = g.machines.slice(1);
  const machines = LABOUR_MACHINES.map((m, i) => {
    const s4Row = m.s4 ? s4Rows.findIndex((x) => same(x[mc.machine]) === same(m.s4)) : -1;
    const r = s4Rows[s4Row];
    const men = r ? num(r[mc.men]) : null;
    const days = r ? num(r[mc.daysRun]) : null;
    return { ...m, cardSeq: i + 1, s4Row: s4Row < 0 ? Infinity : s4Row, menNeeded: men && men > 0 ? men : null, dayOnly: !!r && num(r[mc.shifts]) === 1, daysRun: days === null ? null : Math.round(days) };
  });
  // Fill order (guide v4 fill order update, 4.1 step 2): days run, highest first; equal days run in S4 row order.
  // The guide has no rule yet for a blank days run: such a machine goes last, and the card says so.
  const order = [...machines].sort((a, b) => (b.daysRun ?? -1) - (a.daysRun ?? -1) || a.s4Row - b.s4Row || a.cardSeq - b.cardSeq);
  const noDays = machines.filter((m) => m.daysRun === null && m.menNeeded !== null).map((m) => m.machine);
  const warning = noDays.length ? `Days run is not set in KHG Machines to Run Daily for ${noDays.join(", ")}, so ${noDays.length === 1 ? "it was" : "they were"} given men last` : null;

  // Period (guide 3.4): to the end of the roster, at most 14 days.
  const head = g.roster[0] ?? [];
  const rosterSheet = `Roster ${g.rosterName}, tab MACHINE ROSTER (machine name)`;
  const rc = columns(rosterSheet, head, { section: ["Machine type"], team: ["Team"], role: ["Role"], code: ["Emp code", "Employee code"], name: ["Name"], main: ["Main machine"] });
  const dates = rosterDates(head, d0);
  if (!dates.length) throw new Error(`${rosterSheet}: no date columns found (headings like “Sat 21”). Headings read: ${head.map(text).filter(Boolean).join(" | ") || "none"}`);
  const rosterEnds = dates.map((d) => d.day).sort().at(-1)!;
  const last = [addDays(d0, 13), rosterEnds].sort()[0];
  if (last < d0) throw new Error(`Roster ${g.rosterName} ends ${dMon(rosterEnds)}, before this card starts (${dMon(d0)}) – plant to issue the next roster`);

  // Men (guide 3.3).
  const sc = columns(`${S6.name}, tab Highlighted (Excel data)`, g.skill[0] ?? [], { code: ["Emp code", "Employee code"], erp: ["Machine", "ERP cost code", "Machine ERP cost code"], level: ["Skill level"] });
  // shortcut: a man on several rows of the skill sheet takes the last one; read all his rows if the plant starts listing more than one machine per man.
  const skill = new Map(g.skill.slice(1).map((r) => [code(r[sc.code]), { erp: same(r[sc.erp]), skilled: /^skilled$/i.test(text(r[sc.level])) }]));
  const bc = columns(`${S10.name}, tab Punch Blocked`, g.blocked[0] ?? [], { code: ["Code", "Emp code"] });
  const blocked = new Set(g.blocked.slice(1).map((r) => code(r[bc.code])).filter(Boolean));

  const byId = new Map<string, Man>();
  for (const r of g.roster.slice(1)) {
    const name = text(r[rc.name]);
    if (!name) continue;
    const id = code(r[rc.code]) || name;
    const sectionName = text(r[rc.section]);
    const role = text(r[rc.role]).toLowerCase();
    const sk = skill.get(id);
    const s4Row = sk?.erp ? s4Rows.find((x) => same(x[mc.erp]) === sk.erp) : undefined;
    const homeCard = s4Row && machines.find((m) => m.s4 && same(m.s4) === same(s4Row[mc.machine]));
    // The last row of an emp code wins.
    byId.set(id, {
      id,
      name,
      sectionName,
      section: SECTIONS.find(([re]) => re.test(sectionName))?.[1] ?? null,
      team: text(r[rc.team]),
      operator: role === "operator",
      skilledHelper: role === "helper" && !!sk?.skilled,
      mainCode: code(r[rc.main]),
      home: homeCard ? homeCard.machine : null,
      homeLabel: homeCard ? homeCard.rosterCode : s4Row ? text(s4Row[mc.machine]) : null,
      shifts: new Map(dates.map((d) => [d.day, text(r[d.col]).charAt(0).toUpperCase()])),
    });
  }
  const men = [...byId.values()].filter((p) => p.section !== null && !blocked.has(p.id));
  const byName = (a: Man, b: Man) => a.name.localeCompare(b.name);
  const pool = (p: Man) => p.team.toLowerCase() === "pool";

  // Working days (guide 3.4).
  const planned = new Set(plan.filter((r) => r.qty > 0).map((r) => `${r.day}|${r.machine}`));
  const works = (machine: string, day: Day) => (machine === "WD14" ? WD14_WITH : machine === "WD17" ? WD17_WITH : [machine]).some((m) => planned.has(`${day}|${m}`));

  const labour: LabourRow[] = [];
  const spare: SpareRow[] = [];
  /** Machine and shift → its operator on the machine's previous working date. */
  const before = new Map<string, string | null>();

  for (let day = d0; day <= last; day = addDays(day, 1)) {
    for (const shift of ["Day", "Night"] as const) {
      let avail = men.filter((p) => p.shifts.get(day) === shift[0]);
      const todo = order.filter((m) => works(m.machine, day) && !(m.dayOnly && shift === "Night"));
      const manned = new Set<string>();
      for (const m of todo) {
        const row = { version: "", rowNo: labour.length, day, shift, machine: m.machine };
        if (m.menNeeded === null) {
          labour.push({ ...row, operator: null, helpers: [], menNeeded: 0, menGiven: 0, note: MEN_NOT_SET });
          continue;
        }
        const his = (p: Man) => p.home === m.machine || p.mainCode === m.rosterCode;
        // His own machine works in this shift and still has no operator: he is kept for it.
        const wanted = (p: Man) => todo.some((x) => x !== m && x.menNeeded !== null && !manned.has(x.machine) && (x.machine === p.home || x.rosterCode === p.mainCode));
        const score = (p: Man) => {
          const base = p.home === m.machine ? 10 : p.operator && p.section === m.type ? 10 : p.skilledHelper && p.section === m.type ? 6 : p.operator && SECOND[p.section ?? ""] === m.type ? 3 : null;
          if (base === null) return 0;
          return base + (p.home === m.machine ? 6 : 0) + (p.mainCode === m.rosterCode ? 4 : 0) + (before.get(`${m.machine}|${shift}`) === p.id ? 5 : 0) - (!his(p) && wanted(p) ? 8 : 0);
        };
        const op = avail.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || byName(a.p, b.p))[0]?.p ?? null;
        avail = avail.filter((p) => p !== op);
        const usual = op && (op.homeLabel || op.mainCode);
        const note = !op || op.home === m.machine ? ""
          : op.section !== m.type && !op.skilledHelper ? `${op.sectionName} operator – to confirm`
          : op.skilledHelper ? "skilled helper acting as operator – to confirm"
          : op.mainCode !== m.rosterCode && usual ? `his usual machine: ${usual}`
          : "";
        const rank = (p: Man) =>
          op && p.team !== "" && !pool(p) && p.team === op.team ? 0
          : p.mainCode === m.rosterCode ? 1
          : p.section === m.type ? (pool(p) ? 2 : 3)
          : SECOND[p.section ?? ""] === m.type ? 5
          : pool(p) ? 7 : 8;
        const helpers = avail.filter((p) => !p.operator).sort((a, b) => rank(a) - rank(b) || byName(a, b)).slice(0, m.menNeeded - (op ? 1 : 0));
        avail = avail.filter((p) => !helpers.includes(p));
        labour.push({ ...row, operator: op?.name ?? null, helpers: helpers.map((p) => p.name), menNeeded: m.menNeeded, menGiven: (op ? 1 : 0) + helpers.length, note: note || null });
        before.set(`${m.machine}|${shift}`, op?.id ?? null);
        if (op) manned.add(m.machine);
      }
      spare.push({ version: "", day, shift, men: [...avail].sort(byName).map((p) => (p.operator ? `${p.name} (op)` : p.name)) });
    }
  }
  return { labour, spare, rosterEnds, warning };
}
