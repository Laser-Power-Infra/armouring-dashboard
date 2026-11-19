import { getOutput, getWaiting, machineLabel } from "@/lib/dashboard/data";
import { days, int, km } from "@/lib/format";
import { Empty, Figure, Section } from "@/components/dash/section";
import { OrdersTable } from "@/components/dash/orders-table";
import type { GlyphName } from "@/components/dash/glyph";

/** Block 1: cable ready for armouring (inner sheath done, armouring not done). */
export async function CableReady({ machineCode }: { machineCode: string }) {
  const [waiting, output] = await Promise.all([getWaiting(), getOutput(machineCode)]);
  const ready = waiting.steps.find((s) => s.key === "armouring")!;
  const avg = output.avgKmPerDay;
  const name = machineLabel(machineCode);

  return (
    <Section
      id="cable"
      title={`Cable ready for ${name}`}
      subtitle="Inner sheath done, armouring not done. Biggest first."
      color="--b-cable"
      glyph="drum"
      asOf={waiting.asOf}
    >
      {!waiting.hasData ? (
        <Empty>This fills in after the first refresh of order lines from the SFG dashboard.</Empty>
      ) : ready.km === 0 ? (
        <p className="rounded-xl bg-surface-2 px-4 py-5 text-[15px]">
          <span className="font-semibold text-idle">No cable is ready for {name}.</span> Its men can be utilized for some other purposes.
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <Figure label="Ready" value={km(ready.km)} unit="km" />
            <Figure
              label="Days of cover"
              value={avg ? days(ready.km / avg) : "–"}
              unit={avg ? "days" : undefined}
              note={avg ? `At ${km(avg)} km a working day` : "Needs production entries"}
            />
            <Figure label="Orders" value={int(ready.rows.length)} />
          </div>
          <OrdersTable rows={ready.rows} limit={8} />
        </>
      )}
    </Section>
  );
}

const upstream: { key: string; id: string; title: string; subtitle: string; color: string; glyph: GlyphName }[] = [
  { key: "inner", id: "wait-inner", title: "Waiting for inner sheath", subtitle: "Laid up, not yet sheathed", color: "--b-inner", glyph: "shield" },
  { key: "laying", id: "wait-laying", title: "Cores waiting for laying", subtitle: "Insulated, not yet twisted together. In cable km.", color: "--b-laying", glyph: "twist" },
  { key: "insulation", id: "wait-insulation", title: "Conductor waiting for insulation", subtitle: "Conductor made, not yet insulated", color: "--b-insul", glyph: "core" },
  { key: "outer", id: "wait-outer", title: "Armoured, waiting for outer sheath", subtitle: "Armouring done, not yet finished", color: "--b-outer", glyph: "layers" },
];

/** Blocks 2–5, in md order. */
export async function Upstream() {
  const waiting = await getWaiting();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {upstream.map((u) => {
        const step = waiting.steps.find((s) => s.key === u.key)!;
        return (
          <Section key={u.key} id={u.id} title={u.title} subtitle={u.subtitle} color={u.color} glyph={u.glyph} asOf={waiting.asOf}>
            {!waiting.hasData ? (
              <Empty>Fills in after order lines are loaded.</Empty>
            ) : step.rows.length === 0 ? (
              <Empty>Nothing waiting here.</Empty>
            ) : (
              <>
                <div className="num mb-2 text-[28px] font-semibold tracking-[-0.02em]">
                  {km(step.km)}
                  <span className="ml-1 text-[15px] font-medium text-ink-2">{step.unit}</span>
                  <span className="ml-2 text-[13px] font-normal text-ink-2">in {int(step.rows.length)} orders</span>
                </div>
                <OrdersTable rows={step.rows} unit={step.unit} limit={4} />
              </>
            )}
          </Section>
        );
      })}
    </div>
  );
}
