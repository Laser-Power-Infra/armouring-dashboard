// Pure calculations for the dashboard blocks (md §5, §6, §7). No DB access here.

/** Canonical stage codes. Loaders must normalise SFG stage names to these. */
export const STAGES = ["CONDUCTOR", "INSULATION", "LAYING", "INNER_SHEATH", "ARMOURING", "OUTER_SHEATH"] as const;
export type Stage = (typeof STAGES)[number];

export type OrderLineRow = {
  prodOrder: string;
  stage: string;
  sfgItem: string;
  customer: string | null;
  cable: string | null;
  coresPerCable: number | null;
  orderedQty: number;
  doneQty: number;
  approved: boolean | null;
};

export type OrderSummary = {
  prodOrder: string;
  customer: string;
  cable: string;
  approved: boolean;
  /** cable km (laying onwards) or core km (conductor, insulation), summed over the order's lines */
  done: Partial<Record<Stage, number>>;
  ordered: Partial<Record<Stage, number>>;
  /** cable km the insulated cores can make: min over core lines of done ÷ cores (md §5 block 3) */
  insulatedCableKm: number | null;
};

export type WaitingRow = { prodOrder: string; customer: string; cable: string; km: number };

const EPS = 0.0005; // below half a metre counts as nothing waiting

/** Group order lines by order. */
export function summariseOrders(lines: OrderLineRow[]): OrderSummary[] {
  const byOrder = new Map<string, OrderSummary>();
  const insulMin = new Map<string, number>();
  for (const l of lines) {
    let o = byOrder.get(l.prodOrder);
    if (!o) {
      o = { prodOrder: l.prodOrder, customer: "", cable: "", approved: false, done: {}, ordered: {}, insulatedCableKm: null };
      byOrder.set(l.prodOrder, o);
    }
    o.customer ||= l.customer ?? "";
    o.cable ||= l.cable ?? "";
    o.approved ||= l.approved === true;
    const st = l.stage as Stage;
    o.done[st] = (o.done[st] ?? 0) + l.doneQty;
    o.ordered[st] = (o.ordered[st] ?? 0) + l.orderedQty;
    // 3 full cores + 1 half core are separate lines: each line's cores_per_cable says how many per cable.
    if (st === "INSULATION" && l.coresPerCable && l.coresPerCable > 0) {
      const cableKm = l.doneQty / l.coresPerCable;
      insulMin.set(l.prodOrder, Math.min(insulMin.get(l.prodOrder) ?? Infinity, cableKm));
    }
  }
  for (const [order, km] of insulMin) byOrder.get(order)!.insulatedCableKm = km;
  return [...byOrder.values()];
}

const biggestFirst = (rows: WaitingRow[]) => rows.filter((r) => r.km > EPS).sort((a, b) => b.km - a.km);

const row = (o: OrderSummary, km: number): WaitingRow => ({
  prodOrder: o.prodOrder,
  customer: o.customer,
  cable: o.cable,
  km,
});

/** Done at `from` minus done at `to`, per order, biggest first (md §5 blocks 1, 2, 4, 5). */
export function waitingBetween(orders: OrderSummary[], from: Stage, to: Stage): WaitingRow[] {
  return biggestFirst(orders.map((o) => row(o, (o.done[from] ?? 0) - (o.done[to] ?? 0))));
}

/** Cores insulated but not yet laid, as cable km (md §5 block 3). */
export function waitingForLaying(orders: OrderSummary[]): WaitingRow[] {
  return biggestFirst(
    orders.filter((o) => o.insulatedCableKm !== null).map((o) => row(o, o.insulatedCableKm! - (o.done.LAYING ?? 0))),
  );
}

/** Armouring ordered minus armouring done, per order (md §5 block 9). */
export function armouringPending(orders: OrderSummary[]): (WaitingRow & { approved: boolean })[] {
  return biggestFirst(orders.map((o) => row(o, (o.ordered.ARMOURING ?? 0) - (o.done.ARMOURING ?? 0)))).map((r) => ({
    ...r,
    approved: orders.find((o) => o.prodOrder === r.prodOrder)!.approved,
  }));
}

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
