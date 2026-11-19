import { getOutput, getStageOutput } from "@/lib/dashboard/data";
import { axisDay, int, km, shortDay } from "@/lib/format";
import { Bars } from "@/components/dash/charts";
import { Empty, Figure, Section } from "@/components/dash/section";
import { Badge } from "@/components/dash/orders-table";

/** Block 6: output by step, last N shift days, slowest step in red. One scale per unit. */
export async function StageOutput({ machineCode }: { machineCode: string }) {
  const { steps, slowest, hasData, asOf } = await getStageOutput(machineCode);
  const any = steps.some((s) => s.total > 0);
  const nDays = steps[0]?.daily.length ?? 10;
  const maxKm = Math.max(0, ...steps.filter((s) => s.unit === "km").flatMap((s) => s.daily.map((d) => d.km)));

  return (
    <Section
      id="output"
      title="Output by step"
      subtitle={`Each shift day, last ${nDays} days`}
      color="--b-output"
      glyph="chart"
      asOf={asOf}
    >
      {!hasData ? (
        <Empty>Fills in once production entries are loaded.</Empty>
      ) : (
        <>
          {!any && (
            <p className="mb-4 rounded-xl bg-warning-bg px-3.5 py-2.5 text-[14px] text-warning">
              No production entries in the last {nDays} shift days. Check that the plant is still entering production.
            </p>
          )}
          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            {steps.map((s) => {
              const isSlow = s.stage === slowest;
              return (
                <div key={s.stage}>
                  <div className="mb-3 flex items-baseline gap-2">
                    <h3 className="text-[15px] font-semibold">{s.label}</h3>
                    {isSlow && <Badge tone="critical">Slowest</Badge>}
                    <span className="num ml-auto text-[13px] text-ink-2">
                      {s.avg !== null ? `${km(s.avg)} ${s.unit} a working day` : "No output"}
                    </span>
                  </div>
                  <Bars
                    label={`${s.label} output per shift day`}
                    unit={s.unit}
                    height={96}
                    max={s.unit === "km" ? maxKm : undefined}
                    bars={s.daily.map((d) => ({
                      key: d.day,
                      axis: axisDay(d.day),
                      segments: [{ name: s.label, value: d.km, color: isSlow ? "--critical" : "--bar" }],
                      tip: (
                        <>
                          <div className="font-semibold">{shortDay(d.day)}</div>
                          <div className="num">
                            {km(d.km, 2)} {s.unit}
                          </div>
                        </>
                      ),
                    }))}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Section>
  );
}

/** Block 7: men vs production, day and night shift. */
export async function MenVsProduction({ machineCode }: { machineCode: string }) {
  const out = await getOutput(machineCode);
  const l = out.latest;

  return (
    <Section
      id="men"
      title="Men and production"
      subtitle="Day and night shift on this machine"
      color="--b-men"
      glyph="people"
      asOf={out.asOf}
    >
      {!out.hasData ? (
        <Empty>Fills in once production entries and men posted are loaded.</Empty>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure
              label={l ? `Made on ${shortDay(l.day)}` : "Latest day"}
              value={l ? km(l.km) : "–"}
              unit="km"
              note={l ? `Day ${km(l.dayKm)}, night ${km(l.nightKm)}` : undefined}
            />
            <Figure
              label="Men posted"
              value={l ? int(l.menDay + l.menNight) : "–"}
              note={l ? `Day ${l.menDay}, night ${l.menNight}` : undefined}
            />
            <Figure
              label="Km per man"
              value={l?.kmPerMan != null ? km(l.kmPerMan, 2) : "–"}
              note={l?.kmPerMan == null ? "No men posted yet" : undefined}
            />
            <Figure
              label="Average a working day"
              value={out.avgKmPerDay !== null ? km(out.avgKmPerDay) : "–"}
              unit="km"
              note="Days with production only"
            />
          </div>
          <Bars
            label="Km made per shift day, day and night shift"
            unit="km"
            legend={[
              { name: "Day shift", color: "--day" },
              { name: "Night shift", color: "--night" },
            ]}
            bars={out.chart.map((d) => ({
              key: d.day,
              axis: axisDay(d.day),
              segments: [
                { name: "Day shift", value: d.dayKm, color: "--day" },
                { name: "Night shift", value: d.nightKm, color: "--night" },
              ],
              sub: d.menDay + d.menNight ? int(d.menDay + d.menNight) : "",
              tip: (
                <>
                  <div className="font-semibold">{shortDay(d.day)}</div>
                  <div className="num">
                    Day {km(d.dayKm, 2)} km, {d.menDay} men
                  </div>
                  <div className="num">
                    Night {km(d.nightKm, 2)} km, {d.menNight} men
                  </div>
                  {d.kmPerMan !== null && <div className="num">{km(d.kmPerMan, 2)} km per man</div>}
                </>
              ),
            }))}
          />
          <p className="mt-1 text-[12px] text-ink-3">Numbers under the dates are men posted that day. ERP posting is 1–2 days late.</p>
        </>
      )}
    </Section>
  );
}
