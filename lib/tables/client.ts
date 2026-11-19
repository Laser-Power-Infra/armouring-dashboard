import type { TableParams } from "./params.ts";

// Browser-side request logic for the tables, kept free of React so it runs in plain tests.

/** Search waits this long after the last keystroke before asking the server. */
export const SEARCH_DEBOUNCE_MS = 700;

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = SEARCH_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waiting: A | undefined;
  const fire = () => {
    const args = waiting;
    cancel();
    if (args) fn(...args);
  };
  const cancel = () => {
    clearTimeout(timer);
    timer = waiting = undefined;
  };
  return {
    call(...args: A) {
      clearTimeout(timer);
      waiting = args;
      timer = setTimeout(fire, ms);
    },
    /** Fire now if a call is waiting (Enter in the search box). */
    flush: fire,
    cancel,
  };
}

/**
 * One request at a time: starting a new one aborts the last, and an answer that arrives
 * after a newer request started is dropped (resolves to undefined) so stale rows never show.
 */
export function createLatest<T>() {
  let current: AbortController | undefined;
  return {
    async run(job: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
      current?.abort();
      const mine = (current = new AbortController());
      try {
        const result = await job(mine.signal);
        return mine === current ? result : undefined;
      } catch (e) {
        if (mine !== current || mine.signal.aborted) return undefined;
        throw e;
      }
    },
    cancel() {
      current?.abort();
      current = undefined;
    },
  };
}

/** The request for one page of a table, or (with `facet`) for one column's filter choices. */
export function tableUrl(table: string, p: TableParams, facet?: { column: string; oq: string; offset: number }): string {
  const sp = new URLSearchParams({ machine: p.machine, page: String(p.page), size: String(p.size), dir: p.dir });
  if (p.sort) sp.set("sort", p.sort);
  if (p.q) sp.set("q", p.q);
  for (const [key, values] of Object.entries(p.filters)) for (const v of values) sp.append(`f.${key}`, v);
  if (facet) {
    sp.set("column", facet.column);
    sp.set("oq", facet.oq);
    sp.set("offset", String(facet.offset));
  }
  return `/api/tables/${table}${facet ? "/facets" : ""}?${sp}`;
}

/** The last page that exists for a total; never below 1. */
export const clampPage = (page: number, size: number, total: number) => Math.max(1, Math.min(page, Math.ceil(total / size)));
