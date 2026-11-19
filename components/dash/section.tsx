import type { ReactNode } from "react";
import type { AsOf } from "@/lib/dashboard/data";
import { dateTime } from "@/lib/format";
import { Glyph, type GlyphName } from "./glyph";

/** One dashboard block: coloured glyph, title, its own "data as of" time (md §4, §7.4). */
export function Section({
  id,
  title,
  subtitle,
  color,
  glyph,
  asOf,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  subtitle?: string;
  color: string;
  glyph: GlyphName;
  asOf?: AsOf;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id && `${id}-title`} className={`scroll-mt-32 rounded-[20px] bg-surface p-5 sm:p-6 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[9px] text-white"
          style={{ background: `var(${color})` }}
          aria-hidden
        >
          <Glyph name={glyph} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id && `${id}-title`} className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
        </div>
        {asOf && <AsOfLabel asOf={asOf} />}
      </header>
      {children}
    </section>
  );
}

export function AsOfLabel({ asOf }: { asOf: AsOf }) {
  if (!asOf.at) {
    return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-ink-2">Not loaded yet</span>;
  }
  const { stale } = asOf;
  return (
    <span
      className={`num rounded-full px-2.5 py-1 text-[12px] ${stale ? "bg-critical-bg font-medium text-critical" : "bg-surface-2 text-ink-2"}`}
      title={stale ? `Older than ${asOf.staleHours} hours` : undefined}
    >
      {stale ? "Out of date: " : "Data as of "}
      {dateTime(asOf.at)}
    </span>
  );
}

/** What to show when a source has not been loaded: say what fills it. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[14px] text-ink-2">{children}</p>;
}

export function SectionSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[20px] bg-surface p-6 ${className}`} aria-busy>
      <div className="mb-5 flex items-center gap-3">
        <div className="size-8 rounded-[9px] bg-surface-2" />
        <div className="h-4 w-40 rounded bg-surface-2" />
      </div>
      <div className="h-28 rounded-xl bg-surface-2" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** A labelled figure. Text stays in ink colours; colour lives on glyphs and marks. */
export function Figure({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  tone?: "critical" | "warning";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div
        className={`num mt-0.5 text-[28px] font-semibold leading-none tracking-[-0.02em] ${
          tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-[15px] font-medium text-ink-2">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-[12px] text-ink-2">{note}</div>}
    </div>
  );
}
