// Card 2, KGP Labour Allocation Card: figures from the Labour allocation and Spare men rows (build spec 6).
import { addDays, dddDMon, dMon, longDay, weeks, type CalCell } from "./calendar.ts";
import { MACHINE_ORDER, MACHINES } from "./machines.ts";
import type { Day, LabourRow, SpareRow } from "./sheet.ts";

export const LABOUR_DAYS = 14;

export type ActionRow = { date: string; shift: "Day" | "Night"; machine: string; problem: string; todo: string };
export type LabourCell = CalCell & { got: number; need: number; /** Every man named and every shift has an operator. */ ok: boolean };

/** One shift of one machine on a day page. Null = the machine does not run in that shift. */
export type ShiftCell = {
  men: string;
  /** Short of men or no operator: the men cell is orange. */
  bad: boolean;
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

const machineRank = (m: string) => (MACHINE_ORDER as string[]).indexOf(m);
const short = (r: LabourRow) => Math.max(0, r.menNeeded - r.menGiven);
/** "Extruder operator – to confirm" gives "Extruder operator". */
const toConfirm = (note: string | null) => (note && /to confirm/i.test(note) ? note.replace(/\s*[–-]\s*to confirm\s*$/i, "") : null);
const usualMachine = (note: string | null) => /home (\S+)/.exec(note ?? "")?.[1] ?? null;

function shiftCell(r: LabourRow | undefined): ShiftCell {
  if (!r) return null;
  return {
    men: `${r.menGiven} of ${r.menNeeded}`,
    bad: !r.operator || short(r) > 0,
    operator: r.operator,
    usual: toConfirm(r.note) ? null : usualMachine(r.note),
    confirm: toConfirm(r.note),
    helpers: r.helpers.join(", ") || "–",
  };
}

export function labourCard(rows: LabourRow[], spare: SpareRow[], d0: Day) {
  const last = addDays(d0, LABOUR_DAYS - 1);
  const labour = rows.filter((r) => r.day >= d0 && r.day <= last);
  const byDay = Map.groupBy(labour, (r) => r.day);
  const sameMonth = d0.slice(0, 7) === last.slice(0, 7);

  const calendar = weeks(d0, LABOUR_DAYS).map((week) =>
    week.map((c): LabourCell => {
      const day = byDay.get(c.day) ?? [];
      const need = day.reduce((s, r) => s + r.menNeeded, 0);
      const got = day.reduce((s, r) => s + r.menGiven, 0);
      return { ...c, need, got, ok: got >= need && day.every((r) => r.operator && short(r) === 0) };
    }),
  );

  const needsAction: ActionRow[] = [...labour]
    .sort((a, b) => a.day.localeCompare(b.day) || a.shift.localeCompare(b.shift) || machineRank(a.machine) - machineRank(b.machine))
    .flatMap((r) => {
      const base = { date: dddDMon(r.day), shift: r.shift, machine: r.machine };
      const out: ActionRow[] = [];
      if (!r.operator) out.push({ ...base, problem: "No experienced operator for this machine", todo: "Plant to name an operator" });
      if (short(r) > 0) out.push({ ...base, problem: `${short(r)} ${short(r) === 1 ? "man" : "men"} short`, todo: `Plant to give ${short(r)} more ${short(r) === 1 ? "man" : "men"}` });
      const kind = toConfirm(r.note);
      if (r.operator && kind) out.push({ ...base, problem: `${r.operator} (${kind}) is not the usual operator of this machine`, todo: "Plant to confirm he can run it" });
      return out;
    });

  const days: DayPage[] = Array.from({ length: LABOUR_DAYS }, (_, i) => {
    const day = addDays(d0, i);
    const today = byDay.get(day) ?? [];
    const running = MACHINE_ORDER.filter((m) => today.some((r) => r.machine === m));
    return {
      day,
      title: longDay(day),
      machines: running.map((name) => ({
        name,
        day: shiftCell(today.find((r) => r.machine === name && r.shift === "Day")),
        night: shiftCell(today.find((r) => r.machine === name && r.shift === "Night")),
      })),
      // A machine at rest (no men set for it) has no labour to name.
      noJob: MACHINE_ORDER.filter((m) => !running.includes(m) && MACHINES[m].menPerShift > 0).join(", "),
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
      period: `${sameMonth ? d0.slice(8).replace(/^0/, "") : dMon(d0)} to ${dMon(last)} ${last.slice(0, 4)} (${LABOUR_DAYS} days)`,
      toFill: labour.length,
      withOperator: labour.filter((r) => r.operator).length,
      fullTeam: labour.filter((r) => r.operator && short(r) === 0).length,
      needingAction: needsAction.length,
    },
    calendar,
    needsAction,
    days,
  };
}
