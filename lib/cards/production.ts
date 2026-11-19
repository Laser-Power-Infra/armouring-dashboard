// Card 1, KGP Machine Production Cards: figures from the Card plan rows (build spec 4).
import { addDays, dMon, span, weeks, type CalCell } from "./calendar.ts";
import { BOTTLENECK, EXT51_COULD_TAKE, MACHINE_ORDER, MACHINES, RUNS_WITH, type MachineInfo, type MachineName } from "./machines.ts";
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
  ext51: boolean;
  core: string;
  lot: string;
  qty: string;
  material: string;
  feed: string;
  /** Drum requirement of a Skip 10 line, printed in the attention colour. */
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
};

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
    const waiting = new Set(lines.filter((r) => r.feedStatus === "wait").map((r) => r.day));

    const calendar = cal.map((week) =>
      week.map((c): ProdCell => {
        if (c.index === null) return { ...c, tone: "out" };
        if (!workingDays.has(c.day)) return { ...c, tone: "idle", small: waiting.has(c.day) ? "waiting for drums" : "off" };
        // Summed in hundredths (the tab holds two decimals) so the total is exact. A total exactly halfway, such as 3.95,
        // goes down to 3.9: that is how every such day is printed on the issued cards.
        const hundredths = lines.filter((r) => r.day === c.day).reduce((s, r) => s + Math.round(r.qty * 100), 0);
        return { ...c, tone: "work", big: follows ? "runs" : (Math.floor((hundredths + 4) / 10) / 10).toFixed(1), dot: dots.has(c.day) };
      }),
    );

    const jobs = lines.map((r, i): JobRow => {
      const [jobMain, ...jobRest] = r.job.split(" – ");
      const jobTail = jobRest.join(" – ");
      const attention = /change/i.test(jobTail) ? jobTail : null;
      const [feedMain, drums] = r.feedStatus === "drum" ? r.feed.split(/\s*·\s*DRUMS:\s*/) : [r.feed];
      return {
        first: i === 0 || lines[i - 1].day !== r.day,
        date: dMon(r.day),
        order: r.prodOrder,
        mc: r.mc,
        partyCable: r.partyCable,
        job: attention ? jobMain : r.job,
        jobAttention: attention,
        ext51: name === BOTTLENECK && EXT51_COULD_TAKE.includes(r.prodOrder.slice(-3)),
        core: r.sizeCore || DASH,
        lot: r.lot,
        qty: r.qty > 0 ? `${r.qty.toFixed(2)} ${r.unit}` : DASH,
        material: r.material || DASH,
        feed: upperFirst(feedMain.replace(/^WAITING FOR DRUMS/, "Waiting for drums")),
        drums: drums ? `Drums: ${drums}` : null,
        status: r.feedStatus,
      };
    });

    return { name, info: MACHINES[name], workingDays, planned, units, load: loadOf(name, workingDays.size), calendar, hasDot: dots.size > 0, jobs };
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
  };
}
