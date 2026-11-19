import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { QueryEnv } from "@/lib/tables/query";
import {
  armouringPending,
  avgPerWorkingDay,
  bobbinPool,
  bobbinTotals,
  dailyOutput,
  dayKey,
  lastShiftDays,
  shiftDayOf,
  summariseOrders,
  sumKm,
  waitingBetween,
  waitingForLaying,
  type Stage,
} from "./calc";

// React cache(): each query runs once per request even when several blocks need it.

export const getSettings = cache(async () => {
  const rows = await db.setting.findMany();
  return new Map(rows.map((r) => [r.key, r.value as unknown]));
});

async function num(key: string): Promise<number | null> {
  const v = (await getSettings()).get(key);
  return typeof v === "number" ? v : null;
}

/** When a block's data was loaded: the oldest loaded_at of its sources; null = a source was never loaded. */
export type AsOf = { at: Date | null; stale: boolean; staleHours: number | null };

async function asOf(...dates: (Date | null | undefined)[]): Promise<AsOf> {
  const present = dates.filter((d): d is Date => !!d);
  // Oldest source wins: a block is only as fresh as its stalest input.
  const at = present.length === dates.length && present.length ? new Date(Math.min(...present.map(Number))) : null;
  const staleHours = await num("stale_data_hours");
  // Stale = older than the limit (md §4: shown in red).
  const stale = !!at && staleHours !== null && Date.now() - at.getTime() > staleHours * 3_600_000;
  return { at, stale, staleHours };
}

export const getMachines = cache(async () => {
  const rows = await db.machineAlias.findMany({ distinct: ["machineCode"], select: { machineCode: true } });
  return rows.map((r) => r.machineCode).sort();
});

const kgpOrders = cache(async () => {
  const prefix = (await getSettings()).get("kgp_order_prefix");
  const lines = await db.orderLine.findMany({
    where: typeof prefix === "string" ? { prodOrder: { startsWith: prefix } } : undefined,
  });
  const loaded = await db.orderLine.aggregate({ _max: { loadedAt: true } });
  return { orders: summariseOrders(lines), loadedAt: loaded._max.loadedAt };
});

/** Blocks 1–5: cable waiting in front of each step. */
export const getWaiting = cache(async () => {
  const { orders, loadedAt } = await kgpOrders();
  const steps: { key: string; before: Stage; unit: "core km" | "km"; rows: ReturnType<typeof waitingBetween> }[] = [
    { key: "insulation", before: "INSULATION", unit: "core km", rows: waitingBetween(orders, "CONDUCTOR", "INSULATION") },
    { key: "laying", before: "LAYING", unit: "km", rows: waitingForLaying(orders) },
    { key: "inner", before: "INNER_SHEATH", unit: "km", rows: waitingBetween(orders, "LAYING", "INNER_SHEATH") },
    { key: "armouring", before: "ARMOURING", unit: "km", rows: waitingBetween(orders, "INNER_SHEATH", "ARMOURING") },
    { key: "outer", before: "OUTER_SHEATH", unit: "km", rows: waitingBetween(orders, "ARMOURING", "OUTER_SHEATH") },
  ];
  return { steps: steps.map((s) => ({ ...s, km: sumKm(s.rows) })), asOf: await asOf(loadedAt), hasData: orders.length > 0 };
});

const entriesLoadedAt = cache(async () => (await db.productionEntry.aggregate({ _max: { loadedAt: true } }))._max.loadedAt);

export const getToday = cache(async () => {
  const start = (await getSettings()).get("day_shift_start");
  // "08:00" or "8:00"; anything unparsable falls back to 08:00 (md §7.1).
  const hour = typeof start === "string" ? parseInt(start, 10) : NaN;
  return shiftDayOf(new Date(), Number.isFinite(hour) ? hour : 8);
});

/** Block 7 and the header: output and men per shift day for one machine. */
export const getOutput = cache(async (machineCode: string) => {
  const [today, lookback, chartDays] = await Promise.all([getToday(), num("avg_lookback_days"), num("stage_chart_days")]);
  const nDays = Math.max(lookback ?? 14, chartDays ?? 10);
  const days = lastShiftDays(today, nDays);
  const since = new Date(`${days[0]}T00:00:00Z`);

  const [entries, lastEntry, erpCodes] = await Promise.all([
    db.productionEntry.findMany({
      where: { machineCode, shiftDay: { gte: since } },
      select: { shiftDay: true, shift: true, qtyM: true, isDuplicate: true },
    }),
    db.productionEntry.findFirst({ where: { machineCode }, orderBy: { enteredAt: "desc" }, select: { enteredAt: true } }),
    db.machineAlias.findMany({ where: { machineCode }, select: { alias: true } }),
  ]);
  // ERP posts men under the cost code (e.g. AR005), which is one of the machine's aliases.
  const men = await db.menPosted.groupBy({
    by: ["date", "shift"],
    where: { date: { gte: since }, costCode: { in: erpCodes.map((a) => a.alias) } },
    _count: { empCode: true },
  });
  const menLoaded = await db.menPosted.aggregate({ _max: { loadedAt: true } });

  const daily = dailyOutput(entries, days);
  const menByDay = new Map<string, { day: number; night: number }>();
  for (const m of men) {
    const k = dayKey(m.date);
    const cur = menByDay.get(k) ?? { day: 0, night: 0 };
    if (m.shift === "NIGHT") cur.night += m._count.empCode;
    else cur.day += m._count.empCode;
    menByDay.set(k, cur);
  }

  const rows = daily.map((d) => {
    const m = menByDay.get(d.day) ?? { day: 0, night: 0 };
    const menTotal = m.day + m.night;
    return { ...d, menDay: m.day, menNight: m.night, kmPerMan: menTotal ? d.km / menTotal : null };
  });
  const avg = avgPerWorkingDay(rows.slice(-(lookback ?? 14)));
  const latest = [...rows].reverse().find((r) => r.km > 0 || r.menDay + r.menNight > 0) ?? null;

  return {
    today,
    chart: rows.slice(-(chartDays ?? 10)),
    avgKmPerDay: avg,
    latest,
    lastEntryAt: lastEntry?.enteredAt ?? null,
    // Loaded at all, even if nothing was made in the window: zero output is an answer, not missing data.
    hasData: !!(await entriesLoadedAt()) || !!menLoaded._max.loadedAt,
    asOf: await asOf(await entriesLoadedAt(), menLoaded._max.loadedAt),
  };
});

/** Block 6: output by step. Steps come from machine_speeds.stage; this machine stands for armouring. */
export const getStageOutput = cache(async (machineCode: string) => {
  const [today, chartDays] = await Promise.all([getToday(), num("stage_chart_days")]);
  const days = lastShiftDays(today, chartDays ?? 10);
  const since = new Date(`${days[0]}T00:00:00Z`);
  const speeds = await db.machineSpeed.findMany({ select: { machineCode: true, stage: true } });
  const machinesFor = (stage: Stage) =>
    stage === "ARMOURING" ? [machineCode] : speeds.filter((s) => s.stage === stage).map((s) => s.machineCode);

  const steps: { stage: Stage; label: string; unit: string }[] = [
    { stage: "INSULATION", label: "Insulation", unit: "core km" },
    { stage: "LAYING", label: "Laying", unit: "km" },
    { stage: "INNER_SHEATH", label: "Inner sheath", unit: "km" },
    { stage: "ARMOURING", label: machineLabel(machineCode), unit: "km" },
  ];
  const result = await Promise.all(
    steps.map(async (s) => {
      const entries = await db.productionEntry.findMany({
        where: { machineCode: { in: machinesFor(s.stage) }, shiftDay: { gte: since } },
        select: { shiftDay: true, shift: true, qtyM: true, isDuplicate: true },
      });
      const daily = dailyOutput(entries, days);
      return { ...s, daily, total: sumKm(daily), avg: avgPerWorkingDay(daily) };
    }),
  );
  // Slowest = lowest average among cable-km steps; insulation is in core km, so it is not compared.
  const comparable = result.filter((r) => r.unit === "km" && r.avg !== null);
  const slowest = comparable.length > 1 ? comparable.reduce((a, b) => (a.avg! <= b.avg! ? a : b)).stage : null;
  const loadedAt = await entriesLoadedAt();
  return { steps: result, slowest, hasData: !!loadedAt, asOf: await asOf(loadedAt) };
});

/** Block 8: bobbins. */
export const getBobbins = cache(async (machineCode: string) => {
  const [lots, latestStatus, owned, lotsLoaded, statusLoaded] = await Promise.all([
    db.lot.findMany({ where: { machineCode, completed: false }, orderBy: [{ priority: "asc" }, { lotNo: "asc" }] }),
    db.bobbinStatus.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
    db.bobbinsOwned.findFirst({ where: { fromDate: { lte: new Date() } }, orderBy: { fromDate: "desc" } }),
    db.lot.aggregate({ _max: { loadedAt: true } }),
    db.bobbinStatus.aggregate({ _max: { loadedAt: true } }),
  ]);
  const counts = latestStatus ? await db.bobbinStatus.findMany({ where: { date: latestStatus.date } }) : [];
  const pool = bobbinPool(counts, owned?.owned ?? null);
  const filled = pool.states.find((s) => s.state.toLowerCase().startsWith("fill"))?.count ?? null;
  return {
    lots: lots.map((l) => ({ ...l, balance: l.bobbinsNeeded - l.bobbinsWound })),
    totals: bobbinTotals(lots),
    filled,
    pool,
    countDate: latestStatus?.date ?? null,
    hasData: !!lotsLoaded._max.loadedAt || !!statusLoaded._max.loadedAt,
    asOf: await asOf(lotsLoaded._max.loadedAt, statusLoaded._max.loadedAt),
  };
});

/** Block 9: all KGP orders with armouring pending, split by plan and approval. */
export const getWorkLeft = cache(async (machineCode: string) => {
  const [{ orders, loadedAt }, output, openLots, jobs] = await Promise.all([
    kgpOrders(),
    getOutput(machineCode),
    db.lot.findMany({ where: { completed: false }, select: { cableItem: true } }),
    db.planJob.findMany({ where: { markComplete: false }, select: { cableItem: true } }),
  ]);
  const pending = armouringPending(orders);
  const planned = new Set([...openLots, ...jobs].map((r) => r.cableItem?.trim().toLowerCase()).filter(Boolean));
  // shortcut: matches by cable name only (plans carry no order number); upgrade when Production Planning gets one.
  const rows = pending.map((r) => ({ ...r, inPlan: planned.has(r.cable.trim().toLowerCase()) }));
  const total = sumKm(rows);
  const days = (km: number) => (output.avgKmPerDay ? km / output.avgKmPerDay : null);
  return {
    rows,
    total,
    days: days(total),
    notInPlan: sumKm(rows.filter((r) => !r.inPlan)),
    notApproved: sumKm(rows.filter((r) => !r.approved)),
    avgKmPerDay: output.avgKmPerDay,
    hasData: orders.length > 0,
    asOf: await asOf(loadedAt),
  };
});

/** Latest production entries, last N shift days. */
export const getLatestEntries = cache(async (machineCode: string) => {
  const [today, n] = await Promise.all([getToday(), num("latest_entries_shift_days")]);
  const days = lastShiftDays(today, n ?? 7);
  const rows = await db.productionEntry.findMany({
    where: { machineCode, shiftDay: { gte: new Date(`${days[0]}T00:00:00Z`) } },
    orderBy: { enteredAt: "desc" },
    take: 200,
  });
  const loadedAt = await entriesLoadedAt();
  return { rows, days: days.length, hasData: !!loadedAt, asOf: await asOf(loadedAt) };
});

/** What a table query needs beyond its params: the client, and the first shift day of the latest-entries window. */
export const getTableEnv = cache(async (): Promise<QueryEnv> => {
  const [today, n] = await Promise.all([getToday(), num("latest_entries_shift_days")]);
  return { client: db, since: new Date(`${lastShiftDays(today, n ?? 7)[0]}T00:00:00Z`) };
});

/** "ARM5" -> "Armouring 5". Other codes are shown as they are. */
export function machineLabel(code: string) {
  const m = /^ARM(\d+)$/.exec(code);
  return m ? `Armouring ${m[1]}` : code;
}
