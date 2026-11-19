import { getBobbins } from "@/lib/dashboard/data";
import { int, shortDay } from "@/lib/format";
import { SplitBar } from "@/components/dash/charts";
import { Panel, Stat } from "@/components/ui/panel";
import { Empty } from "@/components/ui/feedback";
import { ServerTable } from "@/components/dash/server-table";

// Colour follows what the state means, never its rank: usable bobbins in the two brand colours,
// problem states in the status colours. Every part is also named in the legend.
const STATE_COLORS: [RegExp, string][] = [
  [/load/i, "--primary"],
  [/fill/i, "--secondary"],
  [/empty/i, "--line"],
  [/bad|wound/i, "--warning"],
  [/work/i, "--warning-bg"],
  [/brok/i, "--critical"],
];
const colorFor = (state: string) => STATE_COLORS.find(([re]) => re.test(state))?.[1] ?? "--ink-3";

/** Block 8: bobbins for the running and next jobs, and the bobbin pool (md §6). */
export async function Bobbins({ machineCode }: { machineCode: string }) {
  const b = await getBobbins(machineCode);
  const off = b.pool.notCounted !== null && b.pool.notCounted !== 0;

  return (
    <Panel id="bobbins" title="Bobbins" subtitle="For the running job and the next jobs" glyph="spool" asOf={b.asOf}>
      {!b.hasData ? (
        <Empty>Fills in once the Production Planning lots and Bobbin Status sheets are loaded.</Empty>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-8 @4xl:grid-cols-[1fr_1.3fr]">
            <div className="grid grid-cols-3 gap-6">
              <Stat label="Still to wind" value={int(b.totals.toWind)} tone={b.totals.toWind > 0 ? "warning" : undefined} />
              <Stat label="Extra wound" value={int(b.totals.extra)} />
              <Stat label="Filled, unused" value={b.filled !== null ? int(b.filled) : "–"} />
            </div>
            <div>
              <h3 className="mb-3 text-body font-semibold">
                Bobbin pool
                {b.countDate && <span className="ml-2 text-label text-ink-2">counted {shortDay(b.countDate)}</span>}
              </h3>
              <SplitBar
                label="Bobbins by state"
                parts={[
                  ...b.pool.states.map((s) => ({ name: s.state, value: s.count, color: colorFor(s.state) })),
                  ...(off ? [{ name: "Not counted", value: Math.abs(b.pool.notCounted!), color: "--ink" }] : []),
                ]}
              />
              {b.pool.owned !== null && (
                <p className={`mt-3 text-label ${off ? "rounded-control bg-critical-bg px-3 py-2 font-medium text-critical" : "text-ink-2"}`}>
                  {off
                    ? `Count is off by ${int(b.pool.notCounted!)}: ${int(b.pool.counted)} counted against ${int(b.pool.owned)} owned.`
                    : `All ${int(b.pool.owned)} owned bobbins are counted.`}
                </p>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 text-body font-semibold">Open lots</h3>
            {b.openLots === 0 ? <Empty>No open lots for this machine.</Empty> : <ServerTable name="lots" machineCode={machineCode} version={b.asOf.at} />}
            <p className="mt-3 text-caption font-normal text-ink-2">Finished jobs with an open lot make “still to wind” too high. Close them in Production Planning.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}
