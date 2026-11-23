// Card 1, KGP Machine Production Cards: what is printed, from the Card plan rows (docs/final guide for card 1.md, section 5).
import { addDays, dMon, span, weeks, type CalCell } from "./calendar.ts";
import { BOTTLENECK, MACHINE_ORDER, MACHINES, RUNS_WITH, type MachineInfo, type MachineName } from "./machines.ts";
import type { Day, PlanRow } from "./sheet.ts";

export const WIN = 15;

export type ProdCell = CalCell & { tone: "work" | "idle" | "out"; /** Big figure on a working day. */ big?: string; /** Small word on an off day. */ small?: string; dot?: boolean };

export type JobRow = {
  /** First line of its date: the date is printed and a thicker line drawn. */
  first: boolean;
  date: string;
  order: string;
  mc: string;
  partyCable: string;
  job: string;
  /** Part of the job text that needs attention, e.g. "strip change". */
  jobAttention: string | null;
  core: string;
  lot: string;
  qty: string;
  material: string;
  feed: string;
  /** Drum requirement of a line with status "drum", printed in the attention colour. */
  drums: string | null;
  status: PlanRow["feedStatus"];
};

export type Load = { short: string; /** Leading words, in the attention colour when attention is set. */ text: string; tail: string; attention: boolean };

export type MachineCard = {
  name: MachineName;
  info: MachineInfo;
  workingDays: Set<Day>;
  /** "53.8 km", "88.2 core km + 84.6 km", or "–" for a machine with no job list. */
  planned: string;
  units: string[];
  load: Load;
  calendar: ProdCell[][];
  hasDot: boolean;
  jobs: JobRow[];
  /** Raw material to issue to this machine, date by date. */
  rm: Materials;
};

/** kg of each material per date, with a total per material. */
export type Materials = { names: string[]; days: { date: string; kg: number[] }[]; total: number[] };

/** "LT XLPE 1,234 kg · PP FILLER 20 kg" as written on a plan row. */
const parseMaterial = (text: string) =>
  text.split(" · ").flatMap((part) => {
    const m = /^(.*) ([\d,]+) kg$/.exec(part);
    return m ? [{ name: m[1], kg: Number(m[2].replace(/,/g, "")) }] : [];
  });

function materials(lines: PlanRow[]): Materials {
  const names = [...new Set(lines.flatMap((r) => parseMaterial(r.material).map((p) => p.name)))];
  const days = [...Map.groupBy(lines, (r) => r.day)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rows]) => {
      const kg = names.map(() => 0);
      for (const r of rows) for (const p of parseMaterial(r.material)) kg[names.indexOf(p.name)] += p.kg;
      return { date: dMon(day), kg };
    })
    .filter((d) => d.kg.some((k) => k > 0));
  return { names, days, total: names.map((_, i) => days.reduce((s, d) => s + d.kg[i], 0)) };
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DASH = "–";

function loadOf(name: MachineName, days: number): Load {
  if (name === BOTTLENECK) return { short: "Slowest step", text: "Slowest step – this machine decides the finish date", tail: "", attention: true };
  if (days === 0) return { short: "No work", text: "No work in this period", tail: " – the labour can be utilized for some other purposes", attention: true };
  if (days <= 3) return { short: "Low", text: `Low – works only ${days} of ${WIN} days`, tail: ". On the other days the labour can be utilized for some other purposes", attention: true };
  return { short: "Normal", text: "Normal", tail: "", attention: false };
}

export function productionCards(rows: PlanRow[]) {
  if (!rows.length) throw new Error("No card plan rows");
  const d0 = rows.map((r) => r.day).sort()[0];
  const lastDay = addDays(d0, WIN - 1);
  const plan = rows.filter((r) => r.day <= lastDay).sort((a, b) => a.rowNo - b.rowNo);
  const cal = weeks(d0, WIN);
  const byMachine = Map.groupBy(plan, (r) => r.machine);
  const ownDays = (m: MachineName) => new Set((byMachine.get(m) ?? []).filter((r) => r.qty > 0).map((r) => r.day));

  const machines: MachineCard[] = MACHINE_ORDER.map((name) => {
    const lines = (byMachine.get(name) ?? []).sort((a, b) => a.day.localeCompare(b.day) || a.rowNo - b.rowNo);
    const follows = RUNS_WITH[name];
    const workingDays = follows ? new Set(follows.flatMap((m) => [...ownDays(m)])) : ownDays(name);

    const perUnit = new Map<string, number>();
    for (const r of lines) if (r.qty > 0) perUnit.set(r.unit, (perUnit.get(r.unit) ?? 0) + r.qty);
    const units = [...perUnit.keys()];
    const planned = units.length ? units.map((u) => `${perUnit.get(u)!.toFixed(1)} ${u}`).join(" + ") : DASH;

    // A white dot marks a day where the size or material changes: the job says "change", or its kind differs from the line before.
    const dots = new Set<Day>();
    const kind = (job: string) => job.split(" – ")[0];
    lines.forEach((r, i) => {
      if (r.qty > 0 && (/change/i.test(r.job) || (i > 0 && kind(r.job) !== kind(lines[i - 1].job)))) dots.add(r.day);
    });

    const calendar = cal.map((week) =>
      week.map((c): ProdCell => {
        if (c.index === null) return { ...c, tone: "out" };
        if (!workingDays.has(c.day)) return { ...c, tone: "idle", small: "off" };
        // Summed in hundredths (the rows hold two decimals) so the total is exact.
        const hundredths = lines.filter((r) => r.day === c.day).reduce((s, r) => s + Math.round(r.qty * 100), 0);
        return { ...c, tone: "work", big: follows ? "runs" : (Math.round(hundredths / 10) / 10).toFixed(1), dot: dots.has(c.day) };
      }),
    );

    const jobs = lines.map((r, i): JobRow => {
      const [jobMain, ...jobRest] = r.job.split(" – ");
      const jobTail = jobRest.join(" – ");
      const attention = /change/i.test(jobTail) ? jobTail : null;
      return {
        first: i === 0 || lines[i - 1].day !== r.day,
        date: dMon(r.day),
        order: r.prodOrder,
        mc: r.mc,
        partyCable: r.partyCable,
        job: attention ? jobMain : r.job,
        jobAttention: attention,
        core: r.sizeCore || DASH,
        lot: r.lot,
        qty: r.qty > 0 ? `${r.qty.toFixed(2)} ${r.unit}` : DASH,
        material: r.material || DASH,
        feed: upperFirst(r.feed),
        // ACSR Raccoon is wound on finished drums of 2.5 km.
        drums: r.feedStatus === "drum" ? `Drums: needs ${Math.ceil(r.qty / 2.5)} drums of 48×20×28×2.25 RDSO – run only if assembled the day before` : null,
        status: r.feedStatus,
      };
    });

    return { name, info: MACHINES[name], workingDays, planned, units, load: loadOf(name, workingDays.size), calendar, hasDot: dots.size > 0, jobs, rm: materials(lines) };
  });

  const jobLines = plan.filter((r) => r.qty > 0);
  const needDrums = jobLines.filter((r) => r.feedStatus === "drum").length;
  return {
    d0,
    period: `${span(d0, WIN)} (${WIN} days)`,
    cover: {
      jobLines: jobLines.length,
      feedReady: jobLines.length - needDrums,
      // A job line with no feed written against it cannot run; the plan must show none.
      feedMissing: jobLines.filter((r) => !r.feed).length,
      needDrums,
    },
    machines,
    /** Page 2: every material of every machine, and which machines take it. */
    rm: materials(plan),
    takers: (name: string) => machines.flatMap((m) => (m.rm.names.includes(name) ? [`${m.name} (${m.rm.total[m.rm.names.indexOf(name)].toLocaleString("en-US")} kg)`] : [])).join(" · "),
  };
}
