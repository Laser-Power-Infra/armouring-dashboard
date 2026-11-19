"use client";

import { useEffect, useId, useState } from "react";
import type { ClientColumn, TableName } from "@/lib/tables/defs";
import type { TableParams } from "@/lib/tables/params";
import type { FacetOption, Row } from "@/lib/tables/query";
import { clampPage, createLatest, debounce, tableUrl } from "@/lib/tables/client";
import { BLANK, PAGE_SIZES } from "@/lib/tables/shared";
import { int, km, shortDay, time } from "@/lib/format";
import { Button, Spinner } from "./button";
import { Checkbox, SearchInput, Select } from "./field";
import { Empty, ErrorNote } from "./feedback";
import { Badge } from "./panel";
import { Popover } from "./popover";

type Page = { rows: Row[]; total: number };
type Tone = "critical" | "warning" | "good" | "neutral";

/** How a yes/no column reads, in cells and in its filter. Status is always a word, never colour alone. */
const YES_NO: Record<string, { yes: [string, Tone]; no: [string, Tone] }> = {
  approved: { yes: ["Approved", "neutral"], no: ["Not approved", "warning"] },
  inPlan: { yes: ["In plan", "neutral"], no: ["Not in plan", "warning"] },
  isDuplicate: { yes: ["Duplicate", "warning"], no: ["Counted", "neutral"] },
};
const yesNo = (key: string, value: boolean) => (YES_NO[key] ?? { yes: ["Yes", "neutral"], no: ["No", "neutral"] })[value ? "yes" : "no"];

const getJson = async <T,>(url: string, signal: AbortSignal): Promise<T> => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

/**
 * A table whose paging, sorting, search and filter choices all come from the server:
 * the browser holds one page. `initial` is page 1 as rendered on the server, so there is
 * no loading flash on arrival; `version` is the block's data-as-of time, and a change refetches.
 */
export function DataTable({
  table,
  machine,
  title,
  columns,
  initial,
  defaultSort,
  defaultSize,
  version,
}: {
  table: TableName;
  machine: string;
  title: string;
  columns: ClientColumn[];
  initial: Page;
  defaultSort: { key: string; dir: "asc" | "desc" } | null;
  defaultSize: 5 | 10;
  version: string;
}) {
  const [state, setState] = useState({ page: 1, size: defaultSize as number, sort: null as string | null, dir: "desc" as "asc" | "desc", q: "", filters: {} as Record<string, string[]> });
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [retries, setRetries] = useState(0);
  const params: TableParams = { machine, ...state };
  const key = `${JSON.stringify(params)}|${version}|${retries}`;
  // What is on screen, and which request it answers. Loading = the wanted request is not the shown one.
  const [shown, setShown] = useState({ key, data: initial, failed: false });
  const [latest] = useState(() => createLatest<Page>());
  const [search] = useState(() =>
    debounce((q: string) => {
      setTyping(false);
      setState((s) => (s.q === q ? s : { ...s, q, page: 1 }));
    }),
  );
  const loading = shown.key !== key;
  const menuId = useId();

  useEffect(() => {
    if (shown.key === key) return;
    latest
      .run((signal) => getJson<Page>(tableUrl(table, params), signal))
      .then((data) => {
        if (!data) return; // a newer request took over
        const last = clampPage(params.page, params.size, data.total);
        // The list shrank under us: step back to its last page instead of showing nothing.
        if (last !== params.page) setState((s) => ({ ...s, page: last }));
        else setShown({ key, data, failed: false });
      })
      .catch(() => setShown((s) => ({ ...s, key, failed: true })));
    // `key` stands for params, version and retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => (search.cancel(), latest.cancel()), [search, latest]);

  /** Any change to what is shown starts again from page 1. */
  const change = (patch: Partial<typeof state>) => setState((s) => ({ ...s, page: 1, ...patch }));
  const filtered = !!state.q || Object.values(state.filters).some((v) => v.length);
  const clear = () => {
    search.cancel();
    setText("");
    setTyping(false);
    change({ q: "", filters: {} });
  };

  const { rows, total } = shown.data;
  const from = total ? (state.page - 1) * state.size + 1 : 0;
  const to = Math.min(state.page * state.size, total);
  const sortKey = state.sort ?? defaultSort?.key;
  const sortDir = state.sort ? state.dir : defaultSort?.dir;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="w-full sm:w-72"
          label={`Search ${title.toLowerCase()}`}
          value={text}
          pending={typing}
          onChange={(v) => {
            setText(v);
            setTyping(v.trim() !== state.q);
            search.call(v.trim());
          }}
          onSubmit={search.flush}
        />
        {filtered && (
          <Button variant="quiet" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>

      {shown.failed && <ErrorNote message="Could not load this table. The database may be waking up." onRetry={() => setRetries((n) => n + 1)} />}

      <div className="overflow-x-auto border-y border-line-2" style={{ minHeight: total ? 36 + 44 * Math.min(state.size, total) : undefined }}>
        <table className="w-full border-collapse text-left text-label" aria-busy={loading}>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = state.filters[c.key]?.length ?? 0;
                const right = c.kind === "number";
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    className={`h-9 whitespace-nowrap bg-surface p-0 first:sticky first:left-0 first:z-10 ${right ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      popoverTarget={`${menuId}-${c.key}`}
                      className={`inline-flex h-9 items-center gap-1 rounded-control px-3 text-caption hover:bg-ground ${active ? "text-primary" : "text-ink-2"}`}
                    >
                      {c.label}
                      {active > 0 && <span className="num">({active})</span>}
                      {sortKey === c.key && <Arrow up={sortDir === "asc"} />}
                      <Caret />
                    </button>
                    <Popover id={`${menuId}-${c.key}`}>
                      <ColumnMenu
                        id={`${menuId}-${c.key}`}
                        column={c}
                        table={table}
                        params={params}
                        sorted={state.sort === c.key ? state.dir : null}
                        onSort={(dir) => change({ sort: c.key, dir })}
                        onFilter={(values) => change({ filters: { ...state.filters, [c.key]: values } })}
                      />
                    </Popover>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={`transition-opacity duration-150 ${loading ? "opacity-50" : ""}`}>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line-2 hover:bg-ground">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`h-11 max-w-[22rem] truncate whitespace-nowrap bg-inherit px-3 first:sticky first:left-0 first:bg-surface first:font-medium ${c.kind === "number" ? "num text-right" : ""}`}
                  >
                    <Cell column={c} value={r[c.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {total === 0 && !shown.failed && (
          <Empty action={filtered ? <Button onClick={clear}>Clear filters</Button> : undefined}>{filtered ? "No rows match." : "No rows."}</Empty>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="num flex items-center gap-2 text-label text-ink-2" aria-live="polite">
          {total ? `${int(from)}–${int(to)} of ${int(total)}` : "0 rows"}
          {loading && !shown.failed && <Spinner size={12} />}
        </p>
        {total > PAGE_SIZES[0] && (
          <div className="ml-auto flex items-center gap-2">
            <Select aria-label="Rows per page" value={state.size} onChange={(e) => change({ size: Number(e.target.value) })}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} rows
                </option>
              ))}
            </Select>
            <Button disabled={state.page <= 1} onClick={() => setState((s) => ({ ...s, page: s.page - 1 }))}>
              Previous
            </Button>
            <Button disabled={to >= total} onClick={() => setState((s) => ({ ...s, page: s.page + 1 }))}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ column, value }: { column: ClientColumn; value: Row[string] }) {
  if (value === null || value === "") return <span className="text-ink-3">–</span>;
  if (typeof value === "boolean") {
    const [label, tone] = yesNo(column.key, value);
    return tone === "neutral" ? <span className="text-ink-2">{label}</span> : <Badge tone={tone}>{label}</Badge>;
  }
  if (typeof value === "number") return column.format === "km" ? km(value, 2) : int(Math.round(value));
  if (column.kind === "time") return <span className="num">{time(new Date(value))}</span>;
  if (column.kind === "day") return shortDay(value);
  return <span title={value}>{value}</span>;
}

const optionLabel = (column: ClientColumn, value: string) =>
  value === BLANK ? "(blank)" : column.kind === "bool" ? yesNo(column.key, value === "true")[0] : column.kind === "day" ? shortDay(value) : value;

const item = "flex h-8 w-full items-center gap-2 rounded-control px-2 text-left text-label hover:bg-ground aria-pressed:text-primary";

/** A column's menu: sort both ways, and for text, yes/no and day columns the filter choices from the server. */
function ColumnMenu({
  id,
  column,
  table,
  params,
  sorted,
  onSort,
  onFilter,
}: {
  id: string;
  column: ClientColumn;
  table: TableName;
  params: TableParams;
  sorted: "asc" | "desc" | null;
  onSort: (dir: "asc" | "desc") => void;
  onFilter: (values: string[]) => void;
}) {
  const filterable = column.kind === "text" || column.kind === "bool" || column.kind === "day";
  const chosen = params.filters[column.key] ?? [];
  const [facet, setFacet] = useState<{ options: FacetOption[]; hasMore: boolean; state: "idle" | "loading" | "failed" }>({ options: [], hasMore: false, state: "idle" });
  const [oq, setOq] = useState("");
  const [latest] = useState(() => createLatest<{ options: FacetOption[]; hasMore: boolean }>());

  const load = (search: string, offset: number) => {
    setFacet((f) => ({ ...f, state: "loading" }));
    latest
      .run((signal) => getJson(tableUrl(table, params, { column: column.key, oq: search, offset }), signal))
      .then((res) => res && setFacet((f) => ({ options: offset ? [...f.options, ...res.options] : res.options, hasMore: res.hasMore, state: "idle" })))
      .catch(() => setFacet((f) => ({ ...f, state: "failed" })));
  };
  const [narrow] = useState(() => debounce((search: string, run: (s: string) => void) => run(search)));

  // Ask the server each time the menu opens: the choices and counts follow the search and the other filters.
  useEffect(() => {
    if (!filterable) return;
    const el = document.getElementById(id);
    const opened = (e: Event) => (e as ToggleEvent).newState === "open" && load(oq, 0);
    el?.addEventListener("toggle", opened);
    return () => el?.removeEventListener("toggle", opened);
  });
  useEffect(() => () => (narrow.cancel(), latest.cancel()), [narrow, latest]);

  const close = () => document.getElementById(id)?.hidePopover();
  const sort = (dir: "asc" | "desc") => {
    onSort(dir);
    close();
  };

  return (
    <div role="group" aria-label={`${column.label} options`} className="text-left font-normal tracking-normal text-ink">
      <button type="button" className={item} aria-pressed={sorted === "asc"} onClick={() => sort("asc")}>
        <Arrow up /> Sort ascending
      </button>
      <button type="button" className={item} aria-pressed={sorted === "desc"} onClick={() => sort("desc")}>
        <Arrow /> Sort descending
      </button>
      {filterable && (
        <div className="mt-1.5 border-t border-line-2 pt-1.5">
          {(facet.hasMore || facet.options.length > 10 || oq) && (
            <SearchInput
              className="mb-1.5"
              label={`Find ${column.label.toLowerCase()}`}
              value={oq}
              pending={facet.state === "loading"}
              onChange={(v) => {
                setOq(v);
                narrow.call(v.trim(), (s) => load(s, 0));
              }}
              onSubmit={narrow.flush}
            />
          )}
          <div className="max-h-64 overflow-y-auto px-2">
            {facet.options.map((o) => (
              <Checkbox
                key={o.value}
                checked={chosen.includes(o.value)}
                onChange={(e) => onFilter(e.target.checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value))}
                label={
                  <>
                    <span className="min-w-0 flex-1 truncate">{optionLabel(column, o.value)}</span>
                    <span className="num text-ink-2">{int(o.count)}</span>
                  </>
                }
              />
            ))}
            {facet.state === "loading" && facet.options.length === 0 && <p className="flex h-8 items-center gap-2 text-ink-2"><Spinner size={12} /> Loading choices</p>}
            {facet.state === "idle" && facet.options.length === 0 && <p className="flex h-8 items-center text-ink-2">No choices.</p>}
            {facet.state === "failed" && (
              <button type="button" className={`${item} text-critical`} onClick={() => load(oq, 0)}>
                Could not load. Try again
              </button>
            )}
            {facet.hasMore && (
              <button type="button" className={`${item} text-primary`} onClick={() => load(oq, facet.options.length)}>
                Show more
              </button>
            )}
          </div>
          {chosen.length > 0 && (
            <button type="button" className={`${item} mt-1 text-primary`} onClick={() => onFilter([])}>
              Clear this filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Arrow({ up }: { up?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? "M12 19V5m-6 6 6-6 6 6" : "M12 5v14m-6-6 6 6 6-6"} />
    </svg>
  );
}

function Caret() {
  return (
    <svg className="text-ink-3" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
