import type { ReactNode } from "react";
import type { AsOf as AsOfValue } from "@/lib/dashboard/data";
import { dateTime } from "@/lib/format";
import { Glyph, type GlyphName } from "@/components/dash/glyph";

/** One dashboard block: title, its own "data as of" time (md §4, §7.4), then its content. */
export function Panel({
  id,
  title,
  subtitle,
  glyph,
  asOf,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  subtitle?: string;
  glyph?: GlyphName;
  asOf?: AsOfValue;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id && `${id}-title`} className={`scroll-mt-28 rounded-panel border border-line-2 bg-surface p-5 sm:p-6 ${className}`}>
      <header className="mb-5 flex flex-wrap items-start gap-x-3 gap-y-1">
        {glyph && (
          <span className="mt-1 text-ink-2">
            <Glyph name={glyph} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={id && `${id}-title`} className="text-title">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-label text-ink-2">{subtitle}</p>}
        </div>
        {asOf && <AsOf asOf={asOf} />}
      </header>
      {children}
    </section>
  );
}

/** "Data as of": stale data says so in words, not only in red. */
export function AsOf({ asOf }: { asOf: AsOfValue }) {
  if (!asOf.at) return <span className="text-caption text-ink-2">Not loaded yet</span>;
  return (
    <span className={`num text-caption ${asOf.stale ? "text-critical" : "text-ink-2"}`} title={asOf.stale ? `Older than ${asOf.staleHours} hours` : undefined}>
      {asOf.stale ? "Out of date: " : "Data as of "}
      {dateTime(asOf.at)}
    </span>
  );
}

/** A labelled figure. `headline` is sized to be read from across the meeting room. */
export function Stat({
  label,
  value,
  unit,
  note,
  tone,
  size = "figure",
}: {
  label: string;
  value: string;
  unit?: string;
  note?: ReactNode;
  tone?: "critical" | "warning";
  size?: "figure" | "headline";
}) {
  return (
    <div className="min-w-0">
      <div className="text-label text-ink-2">{label}</div>
      <div className={`num mt-1 ${size === "headline" ? "text-headline" : "text-figure"} ${tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : ""}`}>
        {value}
        {unit && <span className="ml-1.5 text-body font-medium tracking-normal text-ink-2">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-label text-ink-2">{note}</div>}
    </div>
  );
}

const tones = {
  critical: "bg-critical-bg text-critical",
  warning: "bg-warning-bg text-warning",
  good: "bg-good-bg text-good",
  neutral: "bg-ground text-ink-2",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-control px-1.5 py-0.5 text-caption ${tones[tone]}`}>{children}</span>;
}
