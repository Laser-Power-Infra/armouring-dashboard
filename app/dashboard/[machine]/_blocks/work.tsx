import { getEntryDays, getWorkLeft } from "@/lib/dashboard/data";
import { days, int, km, shortDay } from "@/lib/format";
import { SplitBar } from "@/components/dash/charts";
import { Panel, Stat } from "@/components/ui/panel";
import { Empty } from "@/components/ui/feedback";
import { ServerTable } from "@/components/dash/server-table";

const round = (v: number) => Math.round(v * 10) / 10;

/** Block 9: all Kharagpur orders with armouring pending. */
export async function WorkLeft({ machineCode }: { machineCode: string }) {
  const w = await getWorkLeft(machineCode);

  return (
    <Panel id="work" title="Work left" subtitle="All Kharagpur orders with armouring still to do" glyph="clock" asOf={w.asOf}>
      {!w.hasData ? (
        <Empty>Fills in after order lines are loaded.</Empty>
      ) : w.count === 0 ? (
        <Empty>No armouring is pending on Kharagpur orders.</Empty>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
            <div className="grid grid-cols-2 gap-6">
              <Stat label="Still to armour" value={km(w.total)} unit="km" />
              <Stat
                label="Days of work"
                value={w.days !== null ? days(w.days) : "–"}
                unit={w.days !== null ? "days" : undefined}
                note={w.avgKmPerDay ? `At ${km(w.avgKmPerDay)} km a working day` : "Needs production entries"}
              />
            </div>
            <div>
              <SplitBar
                label="Work left by plan status"
                parts={[
                  { name: "Planned and approved", value: round(w.plannedApproved), color: "--primary" },
                  { name: "Planned, not approved", value: round(w.plannedNotApproved), color: "--warning" },
                  { name: "Not in any plan", value: round(w.notInPlan), color: "--line" },
                ]}
              />
              <p className="mt-2 text-caption font-normal text-ink-2">In km. Only approved lots can be planned on the machine.</p>
            </div>
          </div>
          <ServerTable name="work-left" machineCode={machineCode} version={w.asOf.at} />
        </div>
      )}
    </Panel>
  );
}

/** Latest production entries: km per shift day, then each drum entered on this machine. */
export async function LatestEntries({ machineCode }: { machineCode: string }) {
  const e = await getEntryDays(machineCode);

  return (
    <Panel id="entries" title="Latest production entries" subtitle="Each drum entered on this machine" glyph="list" asOf={e.asOf}>
      {!e.hasData ? (
        <Empty>Fills in once production entries are loaded.</Empty>
      ) : e.days.length === 0 ? (
        <Empty>No entries in the last shift days.</Empty>
      ) : (
        <div className="space-y-6">
          {/* day-by-day board (md §7.4): what each shift day made; drums entered twice are not added */}
          <ol className="flex gap-x-8 gap-y-4 overflow-x-auto pb-1">
            {e.days.map((d) => (
              <li key={d.day} className="shrink-0">
                <div className="text-label text-ink-2">{shortDay(d.day)}</div>
                <div className="num text-title">
                  {km(d.metres / 1000, 2)} <span className="text-label font-normal text-ink-2">km</span>
                </div>
                <div className="num text-caption font-normal text-ink-2">
                  {int(d.entries)} {d.entries === 1 ? "entry" : "entries"}
                  {d.duplicates > 0 && <span className="text-critical">, {int(d.duplicates)} entered twice</span>}
                </div>
              </li>
            ))}
          </ol>
          <ServerTable name="entries" machineCode={machineCode} version={e.asOf.at} />
        </div>
      )}
    </Panel>
  );
}
