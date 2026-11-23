import { getStageOutput, getWaiting, machineLabel } from "@/lib/dashboard/data";
import type { Stage } from "@/lib/dashboard/calc";
import { km } from "@/lib/format";
import { Panel } from "@/components/ui/panel";

/**
 * The plant line, left to right, with the cable piled in front of each step (md §2, blocks 1–5).
 * Bars share one km scale; insulation is in core km, so it shows a number but no bar.
 */
export async function Pipeline({ machineCode }: { machineCode: string }) {
  const [waiting, stageOut] = await Promise.all([getWaiting(), getStageOutput(machineCode)]);
  const kmBefore = new Map(waiting.steps.map((s) => [s.before, s]));

  const steps: { stage: Stage; name: string; href?: string }[] = [
    { stage: "CONDUCTOR", name: "Conductor" },
    { stage: "INSULATION", name: "Insulation", href: "#wait-insulation" },
    { stage: "LAYING", name: "Laying", href: "#wait-laying" },
    { stage: "INNER_SHEATH", name: "Inner sheath", href: "#wait-inner" },
    { stage: "ARMOURING", name: machineLabel(machineCode), href: "#cable" },
    { stage: "OUTER_SHEATH", name: "Outer sheath", href: "#wait-outer" },
  ];
  const slow = stageOut.steps.find((s) => s.stage === stageOut.slowest);
  const scaleMax = Math.max(0, ...waiting.steps.filter((s) => s.unit === "km").map((s) => s.km)) || 1;

  return (
    <Panel
      id="line"
      title="Cable waiting along the line"
      subtitle="Each bar is the cable waiting in front of that step. Red marks the step with the lowest output a working day."
      asOf={waiting.asOf}
    >
      {!waiting.hasData && <p className="mb-4 text-label text-ink-2">Order lines from the SFG dashboard have not been loaded, so every pile shows zero.</p>}
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-6 sm:gap-0">
        {steps.map((s, i) => {
          const w = kmBefore.get(s.stage);
          const isMachine = s.stage === "ARMOURING";
          const slowest = stageOut.slowest === s.stage;
          const h = w && w.unit === "km" ? (w.km / scaleMax) * 100 : 0;
          const body = (
            <div className="flex flex-col-reverse sm:flex-col">
              {/* pile: vertical on wide screens, horizontal on phones */}
              <div className="flex items-center gap-3 sm:h-40 sm:flex-col sm:justify-end sm:gap-1.5">
                {w ? (
                  <>
                    <span className="num order-2 w-28 shrink-0 whitespace-nowrap text-right text-body font-semibold sm:order-none sm:w-auto sm:text-center">
                      {km(w.km)} <span className="text-caption font-normal text-ink-2">{w.unit}</span>
                    </span>
                    {w.unit === "km" ? (
                      <div className="order-1 h-2.5 min-h-0 flex-1 overflow-hidden bg-line-2 sm:order-none sm:flex sm:w-10 sm:flex-none sm:grow sm:flex-col sm:justify-end sm:bg-transparent">
                        {/* the chosen machine's pile is the one in full colour */}
                        <div data-pile className={isMachine ? "bg-primary" : "bg-primary/30"} style={{ ["--h" as string]: `${h}%` }} />
                      </div>
                    ) : (
                      <div className="order-1 flex-1 text-caption font-normal text-ink-2 sm:order-none sm:flex-none">different unit, no bar</div>
                    )}
                  </>
                ) : (
                  <span className="hidden text-label text-ink-2 sm:block">Start of line</span>
                )}
              </div>
              {/* the step itself, on a rail */}
              <div className="relative mb-2 flex items-center sm:mb-0 sm:mt-3 sm:justify-center">
                <span aria-hidden className={`absolute inset-x-0 top-1/2 hidden h-px bg-line sm:block ${i === 0 ? "left-1/2" : ""} ${i === steps.length - 1 ? "right-1/2" : ""}`} />
                <span
                  className={`relative rounded-control px-2.5 py-1 text-label font-medium ${
                    slowest ? "bg-critical text-white" : isMachine ? "bg-primary text-white" : "border border-line bg-surface text-ink"
                  }`}
                >
                  {s.name}
                  {slowest && <span className="sr-only"> (slowest step)</span>}
                </span>
              </div>
              {slowest && (
                <p className="num mt-1.5 text-caption text-critical sm:text-center">
                  Slowest step{slow?.avg != null && `, ${km(slow.avg)} ${slow.unit} a working day`}
                </p>
              )}
            </div>
          );
          return (
            <li key={s.stage} className="min-w-0 px-1 py-3 sm:px-2 sm:py-2">
              {s.href ? (
                <a href={s.href} className="block rounded-control" aria-label={`${s.name}: ${w ? `${km(w.km)} ${w.unit} waiting` : ""}`}>
                  {body}
                </a>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
