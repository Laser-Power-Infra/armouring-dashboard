// The per-order rules as they were written in TypeScript before they moved into Postgres views.
// Kept only as the reference the views are tested against (tests/db/views.test.ts): if a rule
// changes, change it here and in the migration, and the parity test must still pass.
import type { Stage } from "../../lib/dashboard/calc";

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
