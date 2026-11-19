import { getBobbins } from "@/lib/dashboard/data";
import { int, shortDay } from "@/lib/format";
import { SplitBar } from "@/components/dash/charts";
import { Empty, Figure, Section } from "@/components/dash/section";
import { Badge } from "@/components/dash/orders-table";

// Fixed colour per bobbin state: colour follows the state, never its rank.
const STATE_COLORS: [RegExp, string][] = [
  [/load/i, "--s1"],
  [/fill/i, "--s3"],
  [/empty/i, "--s2"],
  [/bad|wound/i, "--s4"],
  [/work/i, "--s5"],
  [/brok/i, "--s6"],
];
const colorFor = (state: string) => STATE_COLORS.find(([re]) => re.test(state))?.[1] ?? "--ink-3";

/** Block 8: bobbins for the running and next jobs, and the bobbin pool (md §6). */
export async function Bobbins({ machineCode }: { machineCode: string }) {
  const b = await getBobbins(machineCode);
  const off = b.pool.notCounted !== null && b.pool.notCounted !== 0;

  return (
    <Section id="bobbins" title="Bobbins" subtitle="For the running job and the next jobs" color="--b-bobbin" glyph="spool" asOf={b.asOf}>
      {!b.hasData ? (
        <Empty>Fills in once the Production Planning lots and Bobbin Status sheets are loaded.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <div className="mb-5 grid grid-cols-3 gap-4">
              <Figure label="Still to wind" value={int(b.totals.toWind)} tone={b.totals.toWind > 0 ? "warning" : undefined} />
              <Figure label="Extra wound" value={int(b.totals.extra)} />
              <Figure label="Filled, unused" value={b.filled !== null ? int(b.filled) : "–"} />
            </div>
            <h3 className="mb-2 text-[15px] font-semibold">
              Bobbin pool
              {b.countDate && <span className="ml-2 text-[13px] font-normal text-ink-2">counted {shortDay(b.countDate)}</span>}
            </h3>
            <SplitBar
              label="Bobbins by state"
              parts={[
                ...b.pool.states.map((s) => ({ name: s.state, value: s.count, color: colorFor(s.state) })),
                ...(off ? [{ name: "Not counted", value: Math.abs(b.pool.notCounted!), color: "--critical" }] : []),
              ]}
            />
            {b.pool.owned !== null && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-[13px] ${off ? "bg-critical-bg font-medium text-critical" : "bg-surface-2 text-ink-2"}`}>
                {off
                  ? `Count is off by ${int(b.pool.notCounted!)}: ${int(b.pool.counted)} counted against ${int(b.pool.owned)} owned.`
                  : `All ${int(b.pool.owned)} owned bobbins are counted.`}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="mb-2 text-[15px] font-semibold">Open lots</h3>
            {b.lots.length === 0 ? (
              <Empty>No open lots for this machine.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-[14px]">
                  <thead className="text-[12px] text-ink-2">
                    <tr>
                      <th className="py-1.5 pr-3 font-normal">Lot</th>
                      <th className="py-1.5 pr-3 font-normal">Cable and armour</th>
                      <th className="py-1.5 pr-3 text-right font-normal">Needed</th>
                      <th className="py-1.5 pr-3 text-right font-normal">Wound</th>
                      <th className="py-1.5 text-right font-normal">To wind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.lots.map((l) => (
                      <tr key={l.lotNo} className="border-t border-line">
                        <td className="py-2.5 pr-3 align-top">
                          <div className="num font-medium">{l.lotNo}</div>
                          {!l.approved && <Badge tone="warning">Not approved</Badge>}
                        </td>
                        <td className="py-2.5 pr-3 align-top">
                          <div>{l.cableItem ?? "–"}</div>
                          <div className="text-[12px] text-ink-2">{[l.armourType, l.armourSize].filter(Boolean).join(" ") || "Armour not given"}</div>
                        </td>
                        <td className="num py-2.5 pr-3 text-right align-top">{int(l.bobbinsNeeded)}</td>
                        <td className="num py-2.5 pr-3 text-right align-top">{int(l.bobbinsWound)}</td>
                        <td className="num py-2.5 text-right align-top font-semibold">
                          {l.balance > 0 ? int(l.balance) : <span className="font-normal text-ink-2">{l.balance < 0 ? `${int(-l.balance)} extra` : "Done"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink-3">Finished jobs with an open lot make “still to wind” too high. Close them in Production Planning.</p>
          </div>
        </div>
      )}
    </Section>
  );
}
