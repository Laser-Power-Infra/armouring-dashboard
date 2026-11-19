import { getBobbins, getOutput, getWaiting, getWorkLeft, machineLabel } from "@/lib/dashboard/data";
import { dateTime, days, int, km, shortDay } from "@/lib/format";
import { Glyph, type GlyphName } from "@/components/dash/glyph";

// Hairlines between the four answers: stacked on phones, 2×2 on tablets, one row on desktop.
const DIVIDERS = ["", "border-t sm:border-t-0 sm:border-l", "border-t lg:border-t-0 lg:border-l", "border-t sm:border-l lg:border-t-0"];

/** Header line (md §5): the four morning questions answered in one strip. */
export async function Summary({ machineCode }: { machineCode: string }) {
  const [waiting, output, bobbins, work] = await Promise.all([
    getWaiting(),
    getOutput(machineCode),
    getBobbins(machineCode),
    getWorkLeft(machineCode),
  ]);
  const ready = waiting.steps.find((s) => s.key === "armouring")!;
  const avg = output.avgKmPerDay;
  const cover = avg && ready.km > 0 ? ready.km / avg : null;
  const latest = output.latest;
  const latestMen = latest ? latest.menDay + latest.menNight : 0;

  const answers: {
    href: string;
    glyph: GlyphName;
    color: string;
    question: string;
    value: string;
    unit?: string;
    note: string;
    alert?: boolean;
  }[] = [
    {
      href: "#cable",
      glyph: "drum",
      color: "--b-cable",
      question: "Cable ready for the machine",
      value: !waiting.hasData ? "–" : cover !== null ? days(cover) : km(ready.km),
      unit: !waiting.hasData ? undefined : cover !== null ? "days" : "km",
      note: !waiting.hasData
        ? "Order lines not loaded yet"
        : ready.km > 0
          ? `${km(ready.km)} km across ${ready.rows.length} orders`
          : "Nothing ready. Men can be utilized for some other purposes",
      alert: waiting.hasData && ready.km === 0,
    },
    {
      href: "#men",
      glyph: "people",
      color: "--b-men",
      question: "Did the men produce",
      value: latest ? km(latest.km) : "–",
      unit: latest ? "km" : undefined,
      note: latest
        ? `${shortDay(latest.day)}, ${int(latestMen)} men posted`
        : output.hasData
          ? "Nothing made in the last two weeks"
          : "Production entries not loaded yet",
      alert: output.hasData && !latest,
    },
    {
      href: "#bobbins",
      glyph: "spool",
      color: "--b-bobbin",
      question: "Bobbins still to wind",
      value: bobbins.hasData ? int(bobbins.totals.toWind) : "–",
      unit: bobbins.hasData ? "bobbins" : undefined,
      note: bobbins.hasData ? `For ${bobbins.lots.length} open lots` : "Lots not loaded yet",
    },
    {
      href: "#work",
      glyph: "clock",
      color: "--b-work",
      question: "Work left",
      value: !work.hasData ? "–" : work.days !== null ? days(work.days) : km(work.total),
      unit: !work.hasData ? undefined : work.days !== null ? "days" : "km",
      note: work.hasData ? `${km(work.total)} km still to armour` : "Order lines not loaded yet",
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-1">
        <div>
          <p className="text-[15px] text-ink-2">Shift day {shortDay(output.today)}</p>
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.025em] sm:text-[40px]">{machineLabel(machineCode)}</h1>
        </div>
        <p className="text-[14px] text-ink-2">
          {output.lastEntryAt ? <>Last entry on the machine {dateTime(output.lastEntryAt)}</> : "No entries on the machine yet"}
        </p>
      </div>
      <nav aria-label="Summary" className="grid overflow-hidden rounded-[20px] bg-surface sm:grid-cols-2 lg:grid-cols-4">
        {answers.map((a, i) => (
          <a key={a.href} href={a.href} className={`group flex flex-col gap-2 border-line p-5 hover:bg-surface-2 ${DIVIDERS[i]}`}>
            <span className="flex items-center gap-2 text-[14px] font-medium text-ink-2">
              <span
                className="grid size-6 place-items-center rounded-[7px] text-white"
                style={{ background: `var(${a.color})` }}
                aria-hidden
              >
                <Glyph name={a.glyph} size={14} />
              </span>
              {a.question}
            </span>
            <span className={`num text-[40px] font-semibold leading-none tracking-[-0.03em] ${a.alert ? "text-idle" : ""}`}>
              {a.value}
              {a.unit && <span className="ml-1.5 text-[17px] font-medium tracking-normal text-ink-2">{a.unit}</span>}
            </span>
            <span className="text-[13px] text-ink-2">{a.note}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
