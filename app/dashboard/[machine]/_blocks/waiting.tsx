import { getOutput, getWaiting, machineLabel } from "@/lib/dashboard/data";
import { days, int, km } from "@/lib/format";
import { Panel, Stat } from "@/components/ui/panel";
import { Empty } from "@/components/ui/feedback";
import { ServerTable } from "@/components/dash/server-table";
import type { GlyphName } from "@/components/dash/glyph";
import type { TableName } from "@/lib/tables/defs";

/** Block 1: cable ready for armouring (inner sheath done, armouring not done). */
export async function CableReady({ machineCode }: { machineCode: string }) {
  const [waiting, output] = await Promise.all([getWaiting(), getOutput(machineCode)]);
  const ready = waiting.steps.find((s) => s.key === "armouring")!;
  const avg = output.avgKmPerDay;
  const name = machineLabel(machineCode);

  return (
    <Panel id="cable" title={`Cable ready for ${name}`} subtitle="Inner sheath done, armouring not done. Biggest first." glyph="drum" asOf={waiting.asOf}>
      {!waiting.hasData ? (
        <Empty>This fills in after the first refresh of order lines from the SFG dashboard.</Empty>
      ) : ready.km === 0 ? (
        <p className="text-body">
          <span className="font-semibold text-secondary">No cable is ready for {name}.</span> Its men can be utilized for some other purposes.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-6">
            <Stat label="Ready" value={km(ready.km)} unit="km" />
            <Stat
              label="Days of cover"
              value={avg ? days(ready.km / avg) : "–"}
              unit={avg ? "days" : undefined}
              note={avg ? `At ${km(avg)} km a working day` : "Needs production entries"}
            />
            <Stat label="Orders" value={int(ready.count)} />
          </div>
          <ServerTable name="cable-ready" machineCode={machineCode} version={waiting.asOf.at} />
        </>
      )}
    </Panel>
  );
}

const upstream: { key: string; table: TableName; title: string; subtitle: string; glyph: GlyphName }[] = [
  { key: "inner", table: "wait-inner", title: "Waiting for inner sheath", subtitle: "Laid up, not yet sheathed", glyph: "shield" },
  { key: "laying", table: "wait-laying", title: "Cores waiting for laying", subtitle: "Insulated, not yet twisted together. In cable km.", glyph: "twist" },
  { key: "insulation", table: "wait-insulation", title: "Conductor waiting for insulation", subtitle: "Conductor made, not yet insulated", glyph: "core" },
  { key: "outer", table: "wait-outer", title: "Armoured, waiting for outer sheath", subtitle: "Armouring done, not yet finished", glyph: "layers" },
];

/** Blocks 2–5, in md order. */
export async function Upstream({ machineCode }: { machineCode: string }) {
  const waiting = await getWaiting();
  return (
    <div className="space-y-6">
      {upstream.map((u) => {
        const step = waiting.steps.find((s) => s.key === u.key)!;
        return (
          <Panel key={u.key} id={u.table} title={u.title} subtitle={u.subtitle} glyph={u.glyph} asOf={waiting.asOf}>
            {!waiting.hasData ? (
              <Empty>Fills in after order lines are loaded.</Empty>
            ) : step.count === 0 ? (
              <Empty>Nothing waiting here.</Empty>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
                <Stat label="Waiting" value={km(step.km)} unit={step.unit} note={`in ${int(step.count)} orders`} />
                <div className="min-w-0">
                  <ServerTable name={u.table} machineCode={machineCode} version={waiting.asOf.at} />
                </div>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
