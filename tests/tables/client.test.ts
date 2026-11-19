import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampPage, createLatest, createSync, debounce, SEARCH_DEBOUNCE_MS, tableUrl } from "../../lib/tables/client";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("debounce", () => {
  it("search waits 700 ms", () => expect(SEARCH_DEBOUNCE_MS).toBe(700));
  it("nothing fires before 700 ms; one call after, with the last arguments", () => {
    const fn = vi.fn();
    const d = debounce(fn);
    d.call("t");
    d.call("ta");
    vi.advanceTimersByTime(600);
    d.call("tat"); // typing again restarts the wait
    vi.advanceTimersByTime(699);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith("tat");
  });
  it("flush fires at once and not again later", () => {
    const fn = vi.fn();
    const d = debounce(fn);
    d.call("tata");
    d.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith("tata");
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("flush with nothing waiting does nothing", () => {
    const fn = vi.fn();
    debounce(fn).flush();
    expect(fn).not.toHaveBeenCalled();
  });
  it("cancel fires nothing", () => {
    const fn = vi.fn();
    const d = debounce(fn);
    d.call("x");
    d.cancel();
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("createLatest", () => {
  it("a slow first request that resolves after a second one is dropped, and was aborted", async () => {
    const l = createLatest<string>();
    let sig1!: AbortSignal;
    const first = l.run((s) => {
      sig1 = s;
      return new Promise((r) => setTimeout(() => r("old"), 500));
    });
    const second = l.run(() => Promise.resolve("new"));
    vi.advanceTimersByTime(500);
    expect(await second).toBe("new");
    expect(await first).toBeUndefined();
    expect(sig1.aborted).toBe(true);
  });
  it("a request rejected because it was aborted resolves to undefined, not an error", async () => {
    const l = createLatest<string>();
    const first = l.run((s) => new Promise((_, reject) => s.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    l.run(() => Promise.resolve("new"));
    expect(await first).toBeUndefined();
  });
  it("a real failure of the latest request rejects", async () => {
    await expect(createLatest<string>().run(() => Promise.reject(new Error("500")))).rejects.toThrow("500");
  });
  it("cancel drops the request in flight", async () => {
    const l = createLatest<string>();
    const p = l.run(() => new Promise((r) => setTimeout(() => r("late"), 100)));
    l.cancel();
    vi.advanceTimersByTime(100);
    expect(await p).toBeUndefined();
  });
});

describe("createSync", () => {
  const slow = (value: string, ms: number) => () => new Promise<string>((r) => setTimeout(() => r(value), ms));
  it("asks for a state that is not on screen", async () => {
    expect(await createSync<string>().want("page2", "page1", () => Promise.resolve("rows of page 2"))).toBe("rows of page 2");
  });
  it("asks for nothing when the wanted state is already on screen", async () => {
    const job = vi.fn(() => Promise.resolve("x"));
    expect(await createSync<string>().want("page1", "page1", job)).toBeUndefined();
    expect(job).not.toHaveBeenCalled();
  });
  it("Next then straight back: the slow page-2 answer must not replace page 1", async () => {
    const s = createSync<string>();
    const page2 = s.want("page2", "page1", slow("rows of page 2", 500)); // Next
    s.want("page1", "page1", slow("never asked", 0)); // Previous, before page 2 answered
    vi.advanceTimersByTime(500);
    expect(await page2).toBeUndefined();
  });
});

describe("tableUrl", () => {
  const p = { machine: "ARM5", page: 2, size: 10, sort: "km", dir: "asc" as const, q: "a b", filters: { cable: ["3C, AL", ""], customer: [] } };
  it("repeats f.<col> for each value, keeps a blank value, skips empty lists", () => {
    expect(tableUrl("work-left", p)).toBe("/api/tables/work-left?machine=ARM5&page=2&size=10&dir=asc&sort=km&q=a+b&f.cable=3C%2C+AL&f.cable=");
  });
  it("omits sort and q when unset", () => {
    expect(tableUrl("lots", { ...p, sort: null, q: "", filters: {} })).toBe("/api/tables/lots?machine=ARM5&page=2&size=10&dir=asc");
  });
  it("facet url adds column, option search and offset", () => {
    expect(tableUrl("work-left", { ...p, filters: {} }, { column: "customer", oq: "ta", offset: 50 })).toBe(
      "/api/tables/work-left/facets?machine=ARM5&page=2&size=10&dir=asc&sort=km&q=a+b&column=customer&oq=ta&offset=50",
    );
  });
});

describe("clampPage: a table on a page past the end steps back to the last page", () => {
  it.each([
    [3, 10, 12, 2],
    [1, 10, 0, 1],
    [2, 10, 20, 2],
    [5, 10, 41, 5],
    [9, 5, 3, 1],
  ])("clampPage(%i, %i, %i) = %i", (page, size, total, want) => expect(clampPage(page, size, total)).toBe(want));
});
