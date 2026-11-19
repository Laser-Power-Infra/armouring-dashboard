import type { ReactNode } from "react";

// Plain HTML charts following the dataviz rules: thin bars, square data ends,
// 2px surface gap between segments, recessive grid, hover/focus tooltip, table view.

export type Segment = { name: string; value: number; color: string };
export type BarDatum = { key: string; axis: string; segments: Segment[]; tip: ReactNode; sub?: ReactNode };

export function Bars({
  bars,
  max,
  unit,
  label,
  height = 140,
  legend,
  barColorOverride,
}: {
  bars: BarDatum[];
  /** shared max keeps small multiples on one scale */
  max?: number;
  unit: string;
  label: string;
  height?: number;
  legend?: { name: string; color: string }[];
  barColorOverride?: string;
}) {
  const top = niceMax(max ?? Math.max(0, ...bars.map((b) => total(b))));
  const n = bars.length;
  const showAxis = (i: number) => n <= 7 || (n - 1 - i) % 2 === 0;

  return (
    <figure className="m-0">
      {legend && legend.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-2" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.name} className="flex items-center gap-1.5">
              <span className="size-2.5" style={{ background: `var(${l.color})` }} />
              {l.name}
            </li>
          ))}
        </ul>
      )}
      <div className="relative" style={{ height }} role="img" aria-label={`${label}. Use Show as table for values.`}>
        {/* top gridline with its value, and the baseline */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="num absolute -top-2.5 right-0 bg-surface pl-1 text-caption font-normal text-ink-3">
          {fmt(top)} {unit}
        </span>
        <div className="absolute inset-x-0 bottom-0 border-t border-line" />
        <div className="absolute inset-0 flex items-end gap-[6%] px-[2%]">
          {bars.map((b, i) => {
            const t = total(b);
            const align = i < n / 3 ? "left-0" : i >= (2 * n) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div
                key={b.key}
                tabIndex={0}
                aria-label={`${b.axis}: ${fmt(t)} ${unit}`}
                className="group relative flex h-full min-w-0 flex-1 cursor-default flex-col-reverse items-stretch gap-[2px]"
              >
                {b.segments.map((s) =>
                  s.value > 0 ? (
                    <div
                      key={s.name}
                      style={{ height: `${(s.value / top) * 100}%`, background: `var(${barColorOverride ?? s.color})` }}
                    />
                  ) : null,
                )}
                {/* hover target is the whole column, bigger than the mark */}
                <div className="absolute inset-0 group-hover:bg-ink/[0.04]" />
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max max-w-[220px] rounded-control bg-ink px-3 py-2 text-caption font-normal text-surface shadow-[0_8px_28px_rgb(0_0_0/0.14)] group-hover:block group-focus-visible:block ${align}`}
                >
                  {b.tip}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[6%] px-[2%]">
        {bars.map((b, i) => (
          <div key={b.key} className="num min-w-0 flex-1 truncate text-center text-caption font-normal text-ink-3">
            {showAxis(i) ? b.axis : ""}
          </div>
        ))}
      </div>
      {bars.some((b) => b.sub) && (
        <div className="mt-1 flex gap-[6%] px-[2%]">
          {bars.map((b) => (
            <div key={b.key} className="num min-w-0 flex-1 truncate text-center text-caption font-normal text-ink-2">
              {b.sub}
            </div>
          ))}
        </div>
      )}
      <TableView bars={bars} unit={unit} />
    </figure>
  );
}

function TableView({ bars, unit }: { bars: BarDatum[]; unit: string }) {
  const names = bars[0]?.segments.map((s) => s.name) ?? [];
  return (
    <details className="mt-3 text-label">
      <summary className="inline-flex items-center gap-1 text-primary">
        <Chevron /> Show as table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[280px] text-left">
          <thead className="text-ink-2">
            <tr>
              <th className="py-1 pr-3 font-normal">Shift day</th>
              {names.map((n) => (
                <th key={n} className="py-1 pr-3 text-right font-normal">
                  {names.length > 1 ? n : unit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {bars.map((b) => (
              <tr key={b.key} className="border-t border-line">
                <td className="py-1 pr-3">{b.axis}</td>
                {b.segments.map((s) => (
                  <td key={s.name} className="py-1 pr-3 text-right">
                    {fmt(s.value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** One horizontal bar split into parts, with a legend (bobbin pool, work left). */
export function SplitBar({ parts, label }: { parts: { name: string; value: number; color: string; note?: string }[]; label: string }) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <figure className="m-0">
      <div className="flex h-3 gap-[2px] overflow-hidden bg-line-2" role="img" aria-label={label}>
        {sum > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div key={p.name} title={`${p.name}: ${fmt(p.value)}`} style={{ width: `${(p.value / sum) * 100}%`, background: `var(${p.color})` }} />
            ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-label sm:grid-cols-3">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0" style={{ background: `var(${p.color})` }} />
            <span className="truncate text-ink-2">{p.name}</span>
            <span className="num ml-auto font-medium">{fmt(p.value)}</span>
            {p.note && <span className="text-caption font-normal text-ink-3">{p.note}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function Chevron() {
  return (
    <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const total = (b: BarDatum) => b.segments.reduce((s, x) => s + x.value, 0);

/** Round the axis top up to 1, 2, 2.5 or 5 × 10^n so the gridline label is a clean number. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
