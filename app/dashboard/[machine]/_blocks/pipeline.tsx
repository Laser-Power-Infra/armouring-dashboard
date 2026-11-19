import { getStageOutput, getWaiting, machineLabel } from "@/lib/dashboard/data";
import type { Stage } from "@/lib/dashboard/calc";
import { km } from "@/lib/format";
import { Section } from "@/components/dash/section";

/**
 * The plant line, left to right, with the cable piled in front of each step (md §2, blocks 1–5).
 * Bars share one km scale; insulation is in core km, so it shows a number but no bar.
 */
export async function Pipeline({ machineCode }: { machineCode: string }) {
  const [waiting, stageOut] = await Promise.all([getWaiting(), getStageOutput(machineCode)]);
  const kmBefore = new Map(waiting.steps.map((s) => [s.before, s]));

  const steps: { stage: Stage; name: string; href?: string; color?: string }[] = [
    { stage: "CONDUCTOR", name: "Conductor" },
    { stage: "INSULATION", name: "Insulation", href: "#wait-insulation", color: "--b-insul" },
    { stage: "LAYING", name: "Laying", href: "#wait-laying", color: "--b-laying" },
    { stage: "INNER_SHEATH", name: "Inner sheath", href: "#wait-inner", color: "--b-inner" },
    { stage: "ARMOURING", name: machineLabel(machineCode), href: "#cable", color: "--b-cable" },
    { stage: "OUTER_SHEATH", name: "Outer sheath", href: "#wait-outer", color: "--b-outer" },
  ];
  const scaleMax = Math.max(0, ...waiting.steps.filter((s) => s.unit === "km").map((s) => s.km)) || 1;

  return (
    <Section
      id="line"
      title="Cable waiting along the line"
      subtitle="How much cable sits in front of each step. The tallest pile shows where work is stuck."
      color="--b-cable"
      glyph="layers"
      asOf={waiting.asOf}
    >
      {!waiting.hasData && (
        <p className="mb-4 text-[14px] text-ink-2">Order lines from the SFG dashboard have not been loaded, so every pile shows zero.</p>
      )}
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-6 sm:gap-0">
        {steps.map((s, i) => {
          const w = kmBefore.get(s.stage);
          const isMachine = s.stage === "ARMOURING";
          const slowest = stageOut.slowest === s.stage;
          const h = w && w.unit === "km" ? (w.km / scaleMax) * 100 : 0;
          const body = (
            <>
              {/* pile: vertical on wide screens, horizontal on phones */}
              <div className="flex items-center gap-3 sm:h-40 sm:flex-col sm:justify-end sm:gap-1.5">
                {w ? (
                  <>
                    <span className="num order-2 w-24 shrink-0 text-right text-[15px] font-semibold sm:order-none sm:w-auto sm:text-center">
                      {km(w.km)} <span className="text-[12px] font-normal text-ink-2">{w.unit}</span>
                    </span>
                    {w.unit === "km" ? (
                      <div className="order-1 h-2.5 min-h-0 flex-1 overflow-hidden rounded-full bg-surface-2 sm:order-none sm:flex sm:w-10 sm:flex-none sm:grow sm:flex-col sm:justify-end sm:rounded-none sm:bg-transparent">
                        <div data-pile className="rounded-full sm:rounded-none sm:rounded-t-[4px]" style={{ ["--h" as string]: `${h}%`, background: `var(${s.color})` }} />
                      </div>
                    ) : (
                      <div className="order-1 flex-1 text-[12px] text-ink-3 sm:order-none sm:flex-none">core km, not to scale</div>
                    )}
                  </>
                ) : (
                  <span className="hidden text-[13px] text-ink-3 sm:block">Start of line</span>
                )}
              </div>
              {/* the step itself, on a rail */}
              <div className="relative mt-2 flex items-center sm:mt-3 sm:justify-center">
                <span aria-hidden className={`absolute inset-x-0 top-1/2 hidden h-px bg-line sm:block ${i === 0 ? "left-1/2" : ""} ${i === steps.length - 1 ? "right-1/2" : ""}`} />
                <span
                  className={`relative rounded-full px-3 py-1.5 text-[13px] font-medium ${
                    slowest
                      ? "bg-critical text-white"
                      : isMachine
                        ? "bg-ink text-surface"
                        : "border border-line bg-surface text-ink"
                  }`}
                >
                  {s.name}
                  {slowest && <span className="sr-only"> (slowest step)</span>}
                </span>
              </div>
              {slowest && <p className="mt-1.5 text-[12px] font-medium text-critical sm:text-center">Slowest step</p>}
            </>
          );
          return (
            <li key={s.stage} className="min-w-0 rounded-xl px-1 py-2 sm:px-2">
              {s.href ? (
                <a href={s.href} className="block rounded-xl" aria-label={`${s.name}: ${w ? `${km(w.km)} ${w.unit} waiting` : ""}`}>
                  {body}
                </a>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
