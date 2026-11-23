import { getBobbins, getOutput, getWaiting, getWorkLeft, machineLabel } from "@/lib/dashboard/data";
import { dateTime, days, int, km, shortDay } from "@/lib/format";
import { Stat } from "@/components/ui/panel";

/** Header line (md §5): the four morning questions answered in one row, sized to be read from across the room. */
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

  const answers: { href: string; question: string; value: string; unit?: string; note: string; idle?: boolean }[] = [
    {
      href: "#cable",
      question: "Cable ready for the machine",
      value: !waiting.hasData ? "–" : cover !== null ? days(cover) : km(ready.km),
      unit: !waiting.hasData ? undefined : cover !== null ? "days" : "km",
      note: !waiting.hasData
        ? "Order lines not loaded yet"
        : ready.km > 0
          ? `${km(ready.km)} km across ${int(ready.count)} orders`
          : "Nothing ready. Men can be utilized for some other purposes",
      idle: waiting.hasData && ready.km === 0,
    },
    {
      href: "#men",
      question: "Did the men produce",
      value: latest ? km(latest.km) : "–",
      unit: latest ? "km" : undefined,
      note: latest
        ? `${shortDay(latest.day)}, ${int(latestMen)} men posted`
        : output.hasData
          ? "Nothing made in the last two weeks"
          : "Production entries not loaded yet",
      idle: output.hasData && !latest,
    },
    {
      href: "#bobbins",
      question: "Bobbins still to wind",
      value: bobbins.hasData ? int(bobbins.totals.toWind) : "–",
      unit: bobbins.hasData ? "bobbins" : undefined,
      note: bobbins.hasData ? `For ${int(bobbins.openLots)} open lots` : "Lots not loaded yet",
    },
    {
      href: "#work",
      question: "Work left",
      value: !work.hasData ? "–" : work.days !== null ? days(work.days) : km(work.total),
      unit: !work.hasData ? undefined : work.days !== null ? "days" : "km",
      note: work.hasData ? `${km(work.total)} km still to armour` : "Order lines not loaded yet",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-page">{machineLabel(machineCode)}</h1>
          <p className="text-label text-ink-2">Shift day {shortDay(output.today)}</p>
        </div>
        <p className="num text-label text-ink-2">
          {output.lastEntryAt ? <>Last entry on the machine {dateTime(output.lastEntryAt)}</> : "No entries on the machine yet"}
        </p>
      </div>
      <nav aria-label="Summary" className="grid gap-x-8 gap-y-6 border-y border-line py-6 sm:grid-cols-2 lg:grid-cols-4">
        {answers.map((a) => (
          <a key={a.href} href={a.href} className="rounded-control">
            <Stat size="headline" label={a.question} value={a.value} unit={a.unit} note={a.note} tone={a.idle ? "idle" : undefined} />
          </a>
        ))}
      </nav>
    </div>
  );
}
