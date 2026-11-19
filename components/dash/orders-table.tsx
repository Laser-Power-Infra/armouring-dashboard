import type { ReactNode } from "react";
import { km } from "@/lib/format";
import { Chevron } from "./charts";

type Row = { prodOrder: string; customer: string; cable: string; km: number };

/** Orders biggest first (md §7.4), customer name shown, long lists folded. */
export function OrdersTable<R extends Row>({
  rows,
  unit = "km",
  limit = 6,
  extra,
}: {
  rows: R[];
  unit?: string;
  limit?: number;
  /** optional extra cell per row, e.g. a status badge */
  extra?: (r: R) => ReactNode;
}) {
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit);
  return (
    <div>
      <List rows={head} unit={unit} extra={extra} />
      {rest.length > 0 && (
        <details className="group/more">
          <summary className="flex items-center gap-1 py-2 text-[14px] text-accent">
            <Chevron /> Show {rest.length} more
          </summary>
          <List rows={rest} unit={unit} extra={extra} />
        </details>
      )}
    </div>
  );
}

function List<R extends Row>({ rows, unit, extra }: { rows: R[]; unit: string; extra?: (r: R) => ReactNode }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.prodOrder} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{r.customer || "Customer not given"}</div>
            <div className="truncate text-[13px] text-ink-2">
              <span className="num">{r.prodOrder}</span>
              {r.cable && <span className="ml-2">{r.cable}</span>}
            </div>
          </div>
          {extra?.(r)}
          <div className="num shrink-0 text-right text-[15px] font-semibold">
            {km(r.km, 2)}
            <span className="ml-1 text-[12px] font-normal text-ink-2">{unit}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Badge({ tone, children }: { tone: "critical" | "warning" | "good" | "neutral"; children: ReactNode }) {
  const cls = {
    critical: "bg-critical-bg text-critical",
    warning: "bg-warning-bg text-warning",
    good: "bg-good-bg text-good",
    neutral: "bg-surface-2 text-ink-2",
  }[tone];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${cls}`}>{children}</span>;
}
