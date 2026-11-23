// Pure calculations for the dashboard blocks (md §5, §6, §7). No DB access here.

/** Canonical stage codes. Loaders must normalise SFG stage names to these. */
export const STAGES = ["CONDUCTOR", "INSULATION", "LAYING", "INNER_SHEATH", "ARMOURING", "OUTER_SHEATH"] as const;
export type Stage = (typeof STAGES)[number];

// The per-order waiting and pending rules (md §5 blocks 1-5, 9) live in Postgres views:
// prisma/migrations/20261119000000_order_views. tests/db proves them against tests/fixtures/order-rules.ts.

const EPS = 0.0005; // below half a metre counts as nothing

export const sumKm = (rows: { km: number }[]) => rows.reduce((s, r) => s + r.km, 0);

// ── Shift days (md §7.1) ────────────────────────────────────────────────

const IST_OFFSET_MIN = 330;

/** Shift day as "YYYY-MM-DD": before the day-shift start (IST) belongs to the previous date. */
export function shiftDayOf(at: Date, dayStartHour = 8): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MIN * 60_000);
  if (ist.getUTCHours() < dayStartHour) ist.setUTCDate(ist.getUTCDate() - 1);
  return ist.toISOString().slice(0, 10);
}

/** The last `n` shift days ending at `today`, oldest first. */
export function lastShiftDays(today: string, n: number): string[] {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// ── Output (md §5 blocks 6, 7) ──────────────────────────────────────────

export type EntryRow = { shiftDay: Date; shift: string; qtyM: number; isDuplicate: boolean };
export type DayOutput = { day: string; dayKm: number; nightKm: number; km: number };

/** km per shift day, split day/night. Duplicate drums are flagged, never added (md §7.1). */
export function dailyOutput(entries: EntryRow[], days: string[]): DayOutput[] {
  const map = new Map(days.map((d) => [d, { day: d, dayKm: 0, nightKm: 0, km: 0 }]));
  for (const e of entries) {
    if (e.isDuplicate) continue;
    const d = map.get(dayKey(e.shiftDay));
    if (!d) continue;
    const km = e.qtyM / 1000;
    if (e.shift === "NIGHT") d.nightKm += km;
    else d.dayKm += km;
    d.km += km;
  }
  return [...map.values()];
}

/** Average km per working day: only days that had production count (md §7.1). */
export function avgPerWorkingDay(days: { km: number }[]): number | null {
  const worked = days.filter((d) => d.km > EPS);
  return worked.length ? sumKm(worked) / worked.length : null;
}

// ── Bobbins (md §6) ─────────────────────────────────────────────────────

export type LotRow = { bobbinsNeeded: number; bobbinsWound: number };

export function bobbinTotals(lots: LotRow[]) {
  let toWind = 0;
  let extra = 0;
  for (const l of lots) {
    const bal = l.bobbinsNeeded - l.bobbinsWound;
    if (bal > 0) toWind += bal;
    else extra += -bal;
  }
  return { toWind, extra };
}

/** Pool by state plus "not counted = owned − counted", which must be zero. */
export function bobbinPool(counts: { state: string; count: number }[], owned: number | null) {
  const byState = new Map<string, number>();
  for (const c of counts) byState.set(c.state, (byState.get(c.state) ?? 0) + c.count);
  const counted = [...byState.values()].reduce((s, n) => s + n, 0);
  return {
    states: [...byState.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count),
    counted,
    owned,
    notCounted: owned === null ? null : owned - counted,
  };
}

/** Length in metres from turns (md §6). */
export const lengthFromTurns = (turns: number, outerDiaMm: number, centreDiaMm: number) =>
  (turns * 3.1416 * (centreDiaMm + outerDiaMm)) / 2000;
