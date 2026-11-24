import { after, connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clubData } from "@/lib/cached";
import { dateTime, shortDay } from "@/lib/format";
import { BOTTLENECK, MACHINE_ORDER } from "@/lib/cards/machines";
import { addDays, isStock, lateness, stageOfJob, type LotState, type LotView, type PlanIn } from "@/lib/club/insight";
import { storeEtas } from "@/lib/club/load";
import { ClubRunHeader } from "./_header";
import { ActionButton, CsvButton, CustomerDate, PrintButton } from "./_controls";
import { moveLot } from "./actions";
import { Panel, Stat, Badge } from "@/components/ui/panel";
import { Empty } from "@/components/ui/feedback";

// Club & Run plan view (plan of 23-Nov, Part 3): which lot runs, which is next, when each order is ready.
export const metadata = { title: "Club & Run – Plan" };
export const instant = false;

const STATE: Record<LotState, { label: string; card: string; dot: string }> = {
  RUNNING: { label: "Running", card: "border-good bg-good-bg", dot: "bg-good" },
  NEXT: { label: "Next", card: "border-primary bg-primary-tint", dot: "bg-primary" },
  QUEUED: { label: "Queued", card: "border-line-2 bg-surface", dot: "bg-ink-3" },
  WAITING: { label: "Waiting", card: "border-warning bg-warning-bg", dot: "bg-warning" },
  DONE: { label: "Done", card: "border-line-2 bg-ground", dot: "bg-good" },
  DRAFT: { label: "Draft – MD approval due", card: "border-dashed border-line bg-surface", dot: "bg-secondary" },
};
// Categorical hues in fixed order (validated default palette, light surface); lots past the eighth fold into grey.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER = "#9a9a9e";

const d = (s: string | null) => (s ? shortDay(s) : "–");
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ClubRunPlanPage({ searchParams }: { searchParams: Search }) {
  await connection();
  const [sp, session, data] = await Promise.all([searchParams, auth(), clubData()]);
  const isMd = session?.user?.role === "admin";
  const { today, orders, views, etas, profiles, plan, issue, drums, prev } = data;
  // The day's snapshot is written after the page is sent, so no one waits on it.
  after(() => storeEtas(db, today, etas));

  const active = views.filter((v) => v.state !== "DONE");
  const running = views.filter((v) => v.state === "RUNNING");
  const next = views.find((v) => v.state === "NEXT");
  const waiting = views.filter((v) => v.state === "WAITING");

  // Delivery plan: every order still to make (not given from stock), one line each.
  const rows = orders
    .filter((o) => !isStock(o) && etas.has(o.prodOrder))
    .map((o) => {
      const p = profiles.get(o.prodOrder)!;
      const e = etas.get(o.prodOrder)!;
      const cust = o.customerDate?.toISOString().slice(0, 10) ?? null;
      const late = lateness(e.fgReady, cust);
      const was = prev.get(o.prodOrder);
      const moved = was && e.fgReady ? Math.round((Date.parse(e.fgReady) - Date.parse(was)) / 86_400_000) : 0;
      const dn = drums.filter((x) => x.prodOrder === o.prodOrder);
      const drum = !dn.length ? "–" : dn.some((x) => /not known/i.test(x.drumSize)) ? "Size not known" : dn.some((x) => x.late) ? "Late" : "Yes";
      const lotRank = views.find((v) => v.lotNo === o.lotNo)?.runOrder ?? 1e9;
      return { o, p, e, cust, late, moved, drum, lotRank };
    })
    .sort((a, b) => a.lotRank - b.lotRank || (a.o.runOrderInLot ?? 0) - (b.o.runOrderInLot ?? 0));
  const party = one(sp.party);
  const lotF = one(sp.lot);
  const lateOnly = one(sp.late) === "1";
  const shown = rows.filter((r) => (!party || r.o.party === party) && (!lotF || (r.o.lotNo ?? "No lot") === lotF) && (!lateOnly || (r.late.days ?? 0) > 0));
  const lateCount = rows.filter((r) => (r.late.days ?? 0) > 0).length;
  const cableLeft = rows.filter((r) => r.p.product === "Cable").reduce((a, r) => a + r.p.leftKm, 0);
  const weekEnd = addDays(today, 6);
  const thisWeek = rows.filter((r) => r.p.product === "Cable" && r.e.fgReady && r.e.fgReady <= weekEnd).reduce((a, r) => a + r.p.leftKm, 0);

  const asOf = `Data as of ${issue?.s8PulledAt ?? "–"} · Cards ${issue?.version ?? "not built yet"}`;
  const csv: (string | number | null)[][] = [
    ["Party", "Order", "Cable", "km", "Lot", "Status", "Conductor ends", "Armouring ends", "FG ready", "Estimated", "Moved (days)", "Customer date", "Gap (days)", "Drums"],
    ...shown.map((r) => [r.o.party, r.o.prodOrder, r.o.cable, r.p.leftKm, r.o.lotNo ?? "No lot", r.p.pending, r.e.conductorEnd, r.e.armouringEnd, r.e.fgReady, r.e.estimated ? "yes" : "", r.moved || "", r.cust, r.late.days, r.drum]),
  ];

  return (
    <>
      <ClubRunHeader active="/club-run" />
      <main className="w-full flex-1 space-y-6 px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="num text-label text-ink-2">{asOf}</p>
          <div className="ml-auto flex gap-2 print:hidden">
            <CsvButton name={`delivery-plan-${today}`} rows={csv} />
            <PrintButton />
          </div>
        </div>

        {/* 5. Summary tiles */}
        <section aria-label="Summary" className="grid grid-cols-2 gap-4 rounded-panel border border-line-2 bg-surface p-5 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Running lots" value={String(running.length)} note={running.map((v) => v.lotNo).join(", ") || "None"} />
          <Stat label="Next lot" value={next?.lotNo ?? "–"} note={next?.whatClubbed ? <span className="line-clamp-2" title={next.whatClubbed}>{next.whatClubbed}</span> : undefined} />
          <Stat label="Cable km left" value={cableLeft.toFixed(1)} unit="km" />
          <Stat label="FG ready this week" value={thisWeek.toFixed(1)} unit="km" note={`to ${shortDay(weekEnd)}`} />
          <Stat label="Late orders" value={String(lateCount)} tone={lateCount ? "critical" : undefined} note={rows.some((r) => r.cust) ? undefined : "No customer dates yet"} />
          <Stat label="Waiting (feed / drum / RM)" value={String(waiting.length)} tone={waiting.length ? "warning" : undefined} />
          <Stat label="Bottleneck" value={BOTTLENECK} note={`~7 km a day`} />
        </section>

        {/* 1. Lot line, in run order */}
        <Panel id="lots" title="Lots in run order" subtitle="Left to right as they run. Colour shows each lot's state." glyph="layers">
          <ol className="flex snap-x gap-3 overflow-x-auto pb-2">
            {active.map((v, i) => (
              <li key={v.lotNo} className={`w-60 shrink-0 snap-start rounded-panel border p-3 ${STATE[v.state].card}`}>
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${STATE[v.state].dot} ${v.state === "RUNNING" ? "motion-safe:animate-pulse" : ""}`} aria-hidden />
                  <span className="text-caption font-semibold uppercase tracking-wide text-ink-2">{STATE[v.state].label}</span>
                  <span className="num ml-auto text-caption text-ink-3">#{v.runOrder}</span>
                </div>
                <div className="mt-1 text-body font-semibold">{v.lotNo}</div>
                <p className="line-clamp-2 min-h-8 text-caption text-ink-2" title={v.whatClubbed ?? undefined}>
                  {v.whatClubbed ?? "–"}
                </p>
                <div className="num mt-2 flex items-baseline justify-between text-label">
                  <span>{v.totalKm} km</span>
                  <span className="text-ink-2">{v.pctDone}% done</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ground" role="img" aria-label={`${v.pctDone}% done`}>
                  <div className="h-full rounded-full bg-good" style={{ width: `${v.pctDone}%` }} />
                </div>
                <div className="mt-2 text-caption">
                  Expected finish: <span className="num font-medium">{d(v.finish)}</span>
                  {v.finishEstimated && <span className="text-ink-3"> (estimated)</span>}
                </div>
                {v.now && <div className="mt-1 text-caption text-good">{v.now}</div>}
                {v.reason && <div className="mt-1 text-caption text-warning">{v.reason}</div>}
                {isMd && (
                  <div className="mt-2 flex gap-1 print:hidden">
                    {i > 0 && (
                      <ActionButton variant="quiet" action={moveLot.bind(null, v.lotNo, -1)}>
                        ← Earlier
                      </ActionButton>
                    )}
                    {i < active.length - 1 && (
                      <ActionButton variant="quiet" action={moveLot.bind(null, v.lotNo, 1)}>
                        Later →
                      </ActionButton>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {views.length > active.length && <p className="mt-2 text-caption text-ink-2">Done: {views.filter((v) => v.state === "DONE").map((v) => v.lotNo).join(", ")}</p>}
        </Panel>

        {/* 2. Stage-wise progress */}
        <Panel id="progress" title="Stage progress" subtitle="Made / ordered at each stage, with start and end on the production cards. The stage running today is marked." glyph="chart">
          <div className="space-y-4">
            {active.filter((v) => v.totalKm > 0 && ["RUNNING", "NEXT", "WAITING"].includes(v.state)).map((v) => (
              <StageBar key={v.lotNo} v={v} />
            ))}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-label text-primary">Other lots ({active.filter((v) => v.totalKm > 0 && !["RUNNING", "NEXT", "WAITING"].includes(v.state)).length})</summary>
            <div className="mt-3 space-y-4">
              {active.filter((v) => v.totalKm > 0 && !["RUNNING", "NEXT", "WAITING"].includes(v.state)).map((v) => (
                <StageBar key={v.lotNo} v={v} />
              ))}
            </div>
          </details>
        </Panel>

        {/* 3. Timeline */}
        <Panel id="timeline" title="Machine timeline" subtitle={`Production cards ${issue?.version ?? ""}: each lot in its own colour. Red line = today. Click a cell for its jobs.`} glyph="clock">
          {plan.length ? <Gantt plan={plan} today={today} views={views} /> : <Empty>No production cards yet.</Empty>}
        </Panel>

        {/* 4. Expected delivery plan */}
        <Panel id="delivery" title="Expected delivery plan" subtitle="One line per order. FG ready = last outer-sheath day on the cards; beyond them, estimated at ~7 km a day on Armouring 5." glyph="list">
          <form className="mb-4 flex flex-wrap items-end gap-3 print:hidden" method="get">
            <label className="text-label">
              <span className="mb-1 block text-ink-2">Party</span>
              <select name="party" defaultValue={party} className="h-9 rounded-control border border-line bg-surface px-2">
                <option value="">All</option>
                {[...new Set(rows.map((r) => r.o.party).filter(Boolean))].sort().map((p) => (
                  <option key={p!}>{p}</option>
                ))}
              </select>
            </label>
            <label className="text-label">
              <span className="mb-1 block text-ink-2">Lot</span>
              <select name="lot" defaultValue={lotF} className="h-9 rounded-control border border-line bg-surface px-2">
                <option value="">All</option>
                {[...new Set(rows.map((r) => r.o.lotNo ?? "No lot"))].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex h-9 items-center gap-2 text-label">
              <input type="checkbox" name="late" value="1" defaultChecked={lateOnly} /> Late only
            </label>
            <button className="h-9 rounded-control border border-line bg-surface px-3 text-label hover:bg-ground">Show</button>
          </form>
          <div className="overflow-x-auto border-l border-t border-line-2">
            <table className="w-full border-separate border-spacing-0 text-left text-label">
              <thead>
                <tr>
                  {["Party", "Order", "Cable", "km left", "Lot", "Status", "Conductor ends", "Armouring ends", "FG ready", "Customer date", "Gap", "Drums"].map((h) => (
                    <th key={h} className="h-9 whitespace-nowrap border-b border-r border-line-2 bg-ground px-3 text-caption font-normal text-ink-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.o.prodOrder} className={r.late.tone === "late" ? "bg-critical-bg" : r.late.tone === "warn" ? "bg-warning-bg" : r.late.tone === "ok" ? "bg-good-bg" : ""}>
                    <td className="border-b border-r border-line-2 px-3 py-2">{r.o.party}</td>
                    <td className="num whitespace-nowrap border-b border-r border-line-2 px-3">{r.o.prodOrder}</td>
                    <td className="max-w-64 border-b border-r border-line-2 px-3 text-caption">{r.o.cable}</td>
                    <td className="num border-b border-r border-line-2 px-3 text-right">{r.p.leftKm}</td>
                    <td className="whitespace-nowrap border-b border-r border-line-2 px-3">{r.o.lotNo ?? <span className="text-ink-3">No lot</span>}</td>
                    <td className="whitespace-nowrap border-b border-r border-line-2 px-3">{r.e.note ?? r.p.pending}</td>
                    <td className="num whitespace-nowrap border-b border-r border-line-2 px-3">{d(r.e.conductorEnd)}</td>
                    <td className="num whitespace-nowrap border-b border-r border-line-2 px-3">{d(r.e.armouringEnd)}</td>
                    <td className="num whitespace-nowrap border-b border-r border-line-2 px-3">
                      {d(r.e.fgReady)}
                      {r.e.estimated && <span className="text-ink-3"> est.</span>}
                      {r.moved !== 0 && (
                        <span className={`ml-1 ${r.moved > 0 ? "text-critical" : "text-good"}`} title="Since yesterday">
                          {r.moved > 0 ? `↓ ${r.moved}d later` : `↑ ${-r.moved}d earlier`}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-r border-line-2 px-3">{isMd ? <CustomerDate prodOrder={r.o.prodOrder} value={r.cust} /> : d(r.cust)}</td>
                    <td className="num whitespace-nowrap border-b border-r border-line-2 px-3">
                      {r.late.days === null ? "–" : r.late.days <= 0 ? <Badge tone="good">{-r.late.days}d early</Badge> : <Badge tone={r.late.tone === "late" ? "critical" : "warning"}>{r.late.days}d late</Badge>}
                    </td>
                    <td className="whitespace-nowrap border-b border-r border-line-2 px-3">{r.drum === "Yes" ? "Yes" : r.drum === "–" ? <span className="text-ink-3">–</span> : <Badge tone="warning">{r.drum}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!shown.length && <Empty>No orders match.</Empty>}
          <p className="mt-3 text-caption text-ink-2">
            Green: before the customer&apos;s date · amber: up to 5 days late · red: more than 5 days late. Customer dates are typed by the MD here (not in ERP data yet). ↑ / ↓ = moved since the day before. Last refresh {issue ? dateTime(issue.loadedAt) : "–"}.
          </p>
        </Panel>
      </main>
    </>
  );
}

function StageBar({ v }: { v: LotView }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-2 text-label">
        <span className="font-semibold">{v.lotNo}</span>
        <span className="text-caption text-ink-2">{STATE[v.state].label}</span>
        {v.now && <span className="text-caption text-good">{v.now}</span>}
      </div>
      <ol className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
        {v.stages.filter((s) => s.net > 0 || s.start || !s.unit).map((s) => {
          const pct = s.net > 0 ? Math.min(100, Math.round((100 * s.done) / s.net)) : 0;
          return (
            <li key={s.stage} className={`rounded-control border p-2 ${s.active ? "border-good" : "border-line-2"}`}>
              <div className="flex items-center gap-1.5 text-caption font-medium">
                {s.active && <span className="size-2 rounded-full bg-good motion-safe:animate-ping" aria-hidden />}
                {s.stage}
                <span className="num ml-auto text-ink-2">{s.net > 0 ? `${pct}%` : ""}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ground">
                <div className={`h-full rounded-full ${pct >= 100 ? "bg-good" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="num mt-1 text-caption text-ink-2">{s.net > 0 ? `${s.done} / ${s.net} ${s.unit} · ${Math.max(0, Math.round((s.net - s.done) * 100) / 100)} left` : s.unit ? "–" : "after Kharagpur"}</div>
              {(s.start || s.end) && (
                <div className="num text-caption text-ink-3">
                  {d(s.start)} → {d(s.end)}
                </div>
              )}
              {s.active && <div className="text-caption text-good">{s.active}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Gantt({ plan, today, views }: { plan: PlanIn[]; today: string; views: LotView[] }) {
  const start = plan.map((r) => r.day).sort()[0];
  const last = plan.map((r) => r.day).sort().at(-1)!;
  const n = Math.min(30, Math.round((Date.parse(last) - Date.parse(start)) / 86_400_000) + 1);
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const machines = MACHINE_ORDER.filter((m) => plan.some((r) => r.machine === m));
  const lotOrder = views.map((v) => v.lotNo).filter((l) => plan.some((r) => r.lot === l));
  const colour = (lot: string) => SERIES[lotOrder.indexOf(lot)] ?? OTHER;
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-caption">
        {lotOrder.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ background: colour(l) }} aria-hidden />
            {l}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-caption">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-2 text-left font-normal text-ink-2">Machine</th>
              {days.map((day) => (
                <th key={day} className={`num min-w-14 px-1 font-normal ${day === today ? "text-critical" : "text-ink-2"}`}>
                  {shortDay(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m} className={m === BOTTLENECK ? "bg-critical-bg" : ""}>
                <th className={`sticky left-0 z-10 whitespace-nowrap px-2 py-1 text-left font-medium ${m === BOTTLENECK ? "bg-critical-bg text-critical" : "bg-surface"}`}>
                  {m}
                  {m === BOTTLENECK && <span className="block font-normal">bottleneck</span>}
                </th>
                {days.map((day) => {
                  const jobs = plan.filter((r) => r.machine === m && r.day === day && r.qty > 0);
                  const lots = [...new Set(jobs.map((r) => r.lot))];
                  return (
                    <td key={day} className={`border-t border-line-2 px-0.5 py-1 align-top ${day === today ? "border-l-2 border-l-critical" : ""}`}>
                      {jobs.length > 0 && (
                        <details className="group relative">
                          <summary className="flex cursor-pointer list-none flex-col gap-0.5" title={jobs.map((j) => `${j.lot} ${j.prodOrder} ${j.qty} ${j.unit}`).join("\n")}>
                            {lots.map((l) => (
                              <span key={l} className="block">
                                <span className="block h-2 rounded-sm" style={{ background: colour(l) }} aria-hidden />
                                <span className="text-[10px] leading-tight">{l}</span>
                              </span>
                            ))}
                          </summary>
                          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-control border border-line bg-surface p-2 shadow-lg">
                            <div className="mb-1 font-medium">
                              {m} · {shortDay(day)}
                            </div>
                            <ul className="space-y-1.5">
                              {jobs.map((j, i) => (
                                <li key={i}>
                                  <span className="num font-medium">{j.prodOrder}</span> · {j.lot} · <span className="num">{j.qty} {j.unit}</span>
                                  <div className="text-ink-2">{stageName(j)} – {j.job}</div>
                                  <div className="text-ink-3">Feed: {j.feed}</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </details>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const stageName = (j: PlanIn) => ({ CONDUCTOR: "Conductor", INSULATION: "Insulation", LAYING: "Laying", INNER: "Inner sheath", ARMOURING: "Armouring", FINISH: "Outer sheath", CURING: "Curing" })[stageOfJob(j)];
