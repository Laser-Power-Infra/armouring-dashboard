// Card 2, KGP Labour Allocation Card: figures from the Labour allocation and Spare men rows (Card 2 guide v4, sections 4.2–4.3).
import { addDays, dayIndex, dddDMon, dMon, longDay, weeks, type CalCell } from "./calendar.ts";
import { MACHINES } from "./machines.ts";
import type { Day, LabourRow, SpareRow } from "./sheet.ts";

// Names in "KHG Machines to Run Daily" (S4) of the machines that are only on this card. Boiler 7 has no row there yet.
const S4_ONLY_HERE: Record<string, string> = { "Buncher 4": "Buncher No 4", "Laying 7": "Laying Machine No 7", "Sioplas 3": "Sioplass Line 3" };

/** The fixed machine table of guide 3.1, in the order the card prints the machines (cardSeq = place in this list + 1). */
export const LABOUR_MACHINES = ([
  ["WD14", "WD", "WD14"], ["WD17", "WD", "WD17"], ["Skip (12+7)-1", "SKIP", "SK12+7-1"], ["Skip (12+7)-2", "SKIP", "SK12-7"], ["Skip 8", "SKIP", "SK8"],
  ["Skip 10", "SKIP", "SK10"], ["Skip 11", "SKIP", "SK11"], ["Buncher 4", "SKIP", "BUN4"], ["MS-14", "MST", "MS14"], ["MS-11", "MST", "MS11"], ["MS-18", "MST", "MS18"],
  ["Laying 5", "LAY", "LAY5"], ["Laying 7", "LAY", "LAY7"], ["Armouring 5", "ARM", "ARM5"], ["Extruder 22", "EXT", "EX22"], ["Extruder 35", "EXT", "EX35"],
  ["Extruder 51", "EXT", "EX51"], ["Extruder 52", "EXT", "EX52"], ["Sioplas 4", "SIO", "SIO4"], ["Sioplas 3", "SIO", "SIO3"], ["Boiler 7", "BLR", "BLR7"],
] as const).map(([machine, type, rosterCode]) => ({
  machine: machine as string,
  type: type as string,
  rosterCode: rosterCode as string,
  s4: (MACHINES as Record<string, { s4: string }>)[machine]?.s4 ?? S4_ONLY_HERE[machine] ?? null,
}));

/** Note of a row stored for a machine that works but has no "Men per shift" in S4: nobody is placed on it. */
export const MEN_NOT_SET = "Men per shift not set";

export type ActionRow = { date: string; shift: string; machine: string; problem: string; todo: string };
export type LabourCell = CalCell & { got: number; need: number; /** Every man named and every shift has an operator. */ ok: boolean };

/** One shift of one machine on a day page. Null = the machine does not run in that shift. */
export type ShiftCell = {
  men: string;
  /** Short of men or no operator: the men cell is orange. */
  bad: boolean;
  /** Men per shift is not set in S4: nobody could be placed. */
  notSet: boolean;
  operator: string | null;
  /** Grey line under the operator: his usual machine, when he is on another of the same type. */
  usual: string | null;
  /** Orange line under the operator: he is not the usual operator and the plant must confirm. */
  confirm: string | null;
  helpers: string;
} | null;

export type DayPage = {
  day: Day;
  title: string;
  machines: { name: string; day: ShiftCell; night: ShiftCell }[];
  /** Machines with no job that day; their labour can be utilized for some other purposes. */
  noJob: string;
  spare: { shift: "Day" | "Night"; count: number; operators: string; helpers: string }[];
};

const ORDER = LABOUR_MACHINES.map((m) => m.machine);
const machineRank = (m: string) => ORDER.indexOf(m);
const short = (r: LabourRow) => Math.max(0, r.menNeeded - r.menGiven);
const full = (r: LabourRow) => !!r.operator && short(r) === 0;
const notSet = (r: LabourRow) => r.note === MEN_NOT_SET;
/** "Extruder operator – to confirm" gives "Extruder operator". */
const toConfirm = (note: string | null) => (note && /to confirm/i.test(note) ? note.replace(/\s*[–-]\s*to confirm\s*$/i, "") : null);
/** "his usual machine: SK8" (guide v4) or "same machine type, home SK8" (issues loaded from the sheet) gives "SK8". */
const usualMachine = (note: string | null) => (/his usual machine:\s*(.+)$/.exec(note ?? "") ?? /home (\S+)/.exec(note ?? ""))?.[1] ?? null;

function shiftCell(r: LabourRow | undefined): ShiftCell {
  if (!r) return null;
  if (notSet(r)) return { men: "–", bad: true, notSet: true, operator: null, usual: null, confirm: null, helpers: "–" };
  return {
    men: `${r.menGiven} of ${r.menNeeded}`,
    bad: !full(r),
    notSet: false,
    operator: r.operator,
    usual: toConfirm(r.note) ? null : usualMachine(r.note),
    confirm: toConfirm(r.note),
    helpers: r.helpers.join(", ") || "–",
  };
}

export function labourCard(rows: LabourRow[], spare: SpareRow[], d0: Day) {
  // The period ends with the roster: every date of it has its spare-men rows. Without them, 14 days.
  const last = spare.map((s) => s.day).filter((d) => d >= d0).sort().at(-1) ?? addDays(d0, 13);
  const count = dayIndex(last, d0) + 1;
  const labour = rows
    .filter((r) => r.day >= d0 && r.day <= last)
    .sort((a, b) => a.day.localeCompare(b.day) || a.shift.localeCompare(b.shift) || machineRank(a.machine) - machineRank(b.machine));
  // A machine without "Men per shift" has nobody to count; it shows as one line needing action.
  const counted = labour.filter((r) => !notSet(r));
  const byDay = Map.groupBy(labour, (r) => r.day);
  const sameMonth = d0.slice(0, 7) === last.slice(0, 7);

  const calendar = weeks(d0, count).map((week) =>
    week.map((c): LabourCell => {
      const day = byDay.get(c.day) ?? [];
      const need = day.reduce((s, r) => s + (notSet(r) ? 0 : r.menNeeded), 0);
      const got = day.reduce((s, r) => s + (notSet(r) ? 0 : r.menGiven), 0);
      return { ...c, need, got, ok: day.every(full) };
    }),
  );

  const needsAction: ActionRow[] = counted.flatMap((r) => {
    const base = { date: dddDMon(r.day), shift: r.shift, machine: r.machine };
    const out: ActionRow[] = [];
    if (!r.operator) out.push({ ...base, problem: "No experienced operator for this machine", todo: "Plant to name an operator" });
    // "man" also for more than one: the wording of guide 4.2.
    if (short(r) > 0) out.push({ ...base, problem: `${short(r)} man short`, todo: `Plant to give ${short(r)} more man` });
    const kind = toConfirm(r.note);
    if (r.operator && kind) out.push({ ...base, problem: `${r.operator} (${kind}) is not the usual operator of this machine`, todo: "Plant to confirm he can run it" });
    return out;
  });
  for (const machine of ORDER) {
    if (labour.some((r) => r.machine === machine && notSet(r))) needsAction.push({ date: "–", shift: "–", machine, problem: MEN_NOT_SET, todo: "Fill men per shift in KHG Machines to Run Daily" });
  }

  const days: DayPage[] = Array.from({ length: count }, (_, i) => {
    const day = addDays(d0, i);
    const today = byDay.get(day) ?? [];
    const running = ORDER.filter((m) => today.some((r) => r.machine === m));
    return {
      day,
      title: longDay(day),
      machines: running.map((name) => ({
        name,
        day: shiftCell(today.find((r) => r.machine === name && r.shift === "Day")),
        night: shiftCell(today.find((r) => r.machine === name && r.shift === "Night")),
      })),
      noJob: ORDER.filter((m) => !running.includes(m)).join(", "),
      spare: (["Day", "Night"] as const).flatMap((shift) => {
        const row = spare.find((s) => s.day === day && s.shift === shift);
        if (!row) return [];
        const isOp = (n: string) => /\(op\)\s*$/.test(n);
        return [{
          shift,
          count: row.men.length,
          operators: row.men.filter(isOp).map((n) => n.replace(/\s*\(op\)\s*$/, "")).join(", ") || "–",
          helpers: row.men.filter((n) => !isOp(n)).join(", ") || "–",
        }];
      }),
    };
  });

  return {
    d0,
    facts: {
      period: `${sameMonth ? d0.slice(8).replace(/^0/, "") : dMon(d0)} to ${dMon(last)} ${last.slice(0, 4)} (${count} days)`,
      toFill: counted.length,
      withOperator: counted.filter((r) => r.operator).length,
      fullTeam: counted.filter(full).length,
      needingAction: needsAction.length,
    },
    calendar,
    needsAction,
    days,
  };
}
