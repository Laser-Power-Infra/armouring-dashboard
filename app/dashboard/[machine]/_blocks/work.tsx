import { getLatestEntries, getWorkLeft } from "@/lib/dashboard/data";
import { days, km, shortDay, time } from "@/lib/format";
import { SplitBar } from "@/components/dash/charts";
import { Empty, Figure, Section } from "@/components/dash/section";
import { Badge, OrdersTable } from "@/components/dash/orders-table";
import { dayKey } from "@/lib/dashboard/calc";

/** Block 9: all Kharagpur orders with armouring pending. */
export async function WorkLeft({ machineCode }: { machineCode: string }) {
  const w = await getWorkLeft(machineCode);
  const ready = w.rows.filter((r) => r.inPlan && r.approved);
  const unapprovedInPlan = w.rows.filter((r) => r.inPlan && !r.approved);
  const sum = (rs: { km: number }[]) => rs.reduce((s, r) => s + r.km, 0);

  return (
    <Section id="work" title="Work left" subtitle="All Kharagpur orders with armouring still to do" color="--b-work" glyph="clock" asOf={w.asOf}>
      {!w.hasData ? (
        <Empty>Fills in after order lines are loaded.</Empty>
      ) : w.rows.length === 0 ? (
        <Empty>No armouring is pending on Kharagpur orders.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <div className="mb-5 grid grid-cols-2 gap-4">
              <Figure label="Still to armour" value={km(w.total)} unit="km" />
              <Figure
                label="Days of work"
                value={w.days !== null ? days(w.days) : "–"}
                unit={w.days !== null ? "days" : undefined}
                note={w.avgKmPerDay ? `At ${km(w.avgKmPerDay)} km a working day` : "Needs production entries"}
              />
            </div>
            <SplitBar
              label="Work left by plan status"
              parts={[
                { name: "Planned and approved", value: round(sum(ready)), color: "--s1" },
                { name: "Planned, not approved", value: round(sum(unapprovedInPlan)), color: "--s4" },
                { name: "Not in any plan", value: round(w.notInPlan), color: "--s2" },
              ]}
            />
            <p className="mt-2 text-[12px] text-ink-3">In km. Only approved lots can be planned on the machine.</p>
          </div>
          <div className="min-w-0">
            <OrdersTable
              rows={w.rows}
              limit={6}
              extra={(r) =>
                !r.inPlan ? <Badge tone="neutral">Not planned</Badge> : !r.approved ? <Badge tone="warning">Not approved</Badge> : null
              }
            />
          </div>
        </div>
      )}
    </Section>
  );
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Latest production entries, last 7 shift days, grouped by shift day. */
export async function LatestEntries({ machineCode }: { machineCode: string }) {
  const { rows, days, hasData, asOf } = await getLatestEntries(machineCode);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = dayKey(r.shiftDay);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <Section id="entries" title="Latest production entries" subtitle="Each drum entered on this machine" color="--b-entries" glyph="list" asOf={asOf}>
      {!hasData ? (
        <Empty>Fills in once production entries are loaded.</Empty>
      ) : rows.length === 0 ? (
        <Empty>No entries in the last {days} shift days.</Empty>
      ) : (
        <div className="space-y-5">
          {[...groups].map(([day, list]) => {
            const total = list.filter((r) => !r.isDuplicate).reduce((s, r) => s + r.qtyM, 0) / 1000;
            return (
              <div key={day}>
                <h3 className="mb-1 flex items-baseline text-[15px] font-semibold">
                  {shortDay(day)}
                  <span className="num ml-auto text-[13px] font-normal text-ink-2">{km(total, 2)} km</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[14px]">
                    <thead className="text-[12px] text-ink-2">
                      <tr>
                        <th className="py-1.5 pr-3 font-normal">Time</th>
                        <th className="py-1.5 pr-3 font-normal">Order</th>
                        <th className="py-1.5 pr-3 font-normal">Cable</th>
                        <th className="py-1.5 pr-3 font-normal">Drum</th>
                        <th className="py-1.5 pr-3 text-right font-normal">Metres</th>
                        <th className="py-1.5 font-normal">Entered by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id} className="border-t border-line">
                          <td className="num py-2 pr-3">
                            {time(r.enteredAt)} <span className="text-[12px] text-ink-2">{r.shift === "NIGHT" ? "night" : "day"}</span>
                          </td>
                          <td className="num py-2 pr-3">
                            {r.prodOrders.join(", ") || r.prodOrderRaw || "–"}
                            {r.prodOrders.length > 1 && <span className="ml-1"><Badge tone="warning">Two orders</Badge></span>}
                          </td>
                          <td className="py-2 pr-3">{r.cable ?? "–"}</td>
                          <td className="num py-2 pr-3">
                            {r.drumNo ?? "–"}
                            {r.isDuplicate && <span className="ml-1"><Badge tone="critical">Entered twice</Badge></span>}
                          </td>
                          <td className={`num py-2 pr-3 text-right ${r.isDuplicate ? "text-ink-3 line-through" : ""}`}>{Math.round(r.qtyM).toLocaleString("en-IN")}</td>
                          <td className="py-2">{r.enteredBy ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
