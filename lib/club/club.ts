// Club & Run in the dashboard (plan of 23-Nov, Part 1). Until the cutover the sheet is the master and each sync
// replaces our copy; after it the dashboard is the master and a sync only refreshes what the system owns:
// stage balances, "pending from", lot totals and new Kharagpur orders. It never touches Lot no, Run order,
// Approved by MD or Supply from.
import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";

/** Settings key: "dashboard" once Club & Run is kept here; anything else = the sheet is still the master. */
export const CLUB_MASTER = "club_run_master";
/** Settings key: the latest check of the sheet against the dashboard, while both run side by side. */
export const CLUB_COMPARE = "club_compare";
/** Settings key: Kharagpur orders in SFG not yet approved in ERP (shown apart, never lotted). */
export const CLUB_UNAPPROVED = "club_unapproved";

export const SUPPLY_FROM = ["Manufacture", "Dead stock", "Old stock", "Free stock"] as const;
/** Kharagpur orders; P126Y is Poly Park. The series alone decides the plant. */
export const KGP_SERIES = "P726Y";

const STAGE_FIELD = {
  CONDUCTOR: "conductorBalCoreKm",
  INSULATION: "insulationBalCoreKm",
  LAYING: "layingBalKm",
  INNER: "innerBalKm",
  ARMOURING: "armouringBalKm",
  FINISH: "finishBalKm",
} as const;
export type BalField = (typeof STAGE_FIELD)[keyof typeof STAGE_FIELD];
export const BAL_FIELDS = Object.values(STAGE_FIELD) as BalField[];
const PENDING_NAME: Record<BalField, string> = {
  conductorBalCoreKm: "Conductor",
  insulationBalCoreKm: "Insulation",
  layingBalKm: "Laying",
  innerBalKm: "Inner",
  armouringBalKm: "Armouring",
  finishBalKm: "Outer",
};
export type Bal = Record<BalField, number>;

type Line = { prodOrder: string; stage: string; balance: number; fgType?: string | null };
export type SfgOrder = { prodOrder: string; mcNo: string | null; party: string | null; fgItem: string | null; orderDate: Date | null; approved: string | null };
type OrderRow = { prodOrder: string; toConfirm?: unknown; pendingFrom?: string | null } & Partial<Record<BalField, number | null>>;
type LotRow = { lotNo: string; approvedByMd: boolean; sentToPlant: boolean | null; status: string | null; runOrder: number };

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const zero = (): Bal => Object.fromEntries(BAL_FIELDS.map((f) => [f, 0])) as Bal;

/** Open balance per order per stage, from SFG. Core km up to insulation, cable km after. An order SFG does not list has nothing left. */
export function sfgBalances(lines: Line[]): Map<string, Bal> {
  const out = new Map<string, Bal>();
  for (const l of lines) {
    const f = STAGE_FIELD[l.stage as keyof typeof STAGE_FIELD];
    if (!f || !(l.balance > 0)) continue;
    // HT orders: only conductor and insulation are made at Kharagpur (CR-B-10); the rest is Poly Park's.
    if (/^HT/i.test(l.fgType ?? "") && f !== "conductorBalCoreKm" && f !== "insulationBalCoreKm") continue;
    const b = out.get(l.prodOrder) ?? zero();
    b[f] = r3(b[f] + l.balance);
    // ACSR / AAAC: the stranded conductor is the finished product, so what is left to finish is the conductor.
    if (/STRAND/i.test(l.fgType ?? "") && f === "conductorBalCoreKm") b.finishBalKm = b[f];
    out.set(l.prodOrder, b);
  }
  return out;
}

export const pendingFrom = (b: Partial<Record<BalField, number | null>>) => {
  const f = BAL_FIELDS.find((k) => (b[k] ?? 0) > 0);
  return f ? PENDING_NAME[f] : "Done";
};

// shortcut: "big difference" = more than 2 km and more than 20 % of our figure; tune once the MD names a limit.
export const bigJump = (ours: number | null | undefined, sfg: number) => Math.abs(sfg - (ours ?? 0)) > Math.max(2, 0.2 * (ours ?? 0));

/** New balances for each order. A big jump keeps our figure and parks the SFG one in toConfirm for the MD. */
export function refreshOrders(orders: OrderRow[], lines: Line[]) {
  const sfg = sfgBalances(lines);
  return orders.map((o) => {
    const s = sfg.get(o.prodOrder) ?? zero();
    const data: Partial<Bal> = {};
    const toConfirm: Partial<Bal> = {};
    for (const f of BAL_FIELDS) {
      if (bigJump(o[f], s[f])) toConfirm[f] = s[f];
      else data[f] = s[f];
    }
    const merged = { ...o, ...data };
    return {
      prodOrder: o.prodOrder,
      data: { ...data, pendingFrom: pendingFrom(merged), toConfirm: Object.keys(toConfirm).length ? toConfirm : null },
    };
  });
}

/** "3.5 CORE X 300 SQ. MM. AL/ARD - WIRE (XLPE)" -> 3.5 cores, 300 sq mm, XLPE. */
export function parseFgItem(item: string | null) {
  const s = item ?? "";
  const cores = /(\d+(?:\.\d+)?)\s*CORE/i.exec(s);
  const size = /(\d+(?:\.\d+)?)\s*SQ\.?\s*MM/i.exec(s);
  const ins = /XLPE|PVC/i.exec(s);
  return { cores: cores ? Number(cores[1]) : null, sizeSqmm: size ? Number(size[1]) : null, insulation: ins ? ins[0].toUpperCase() : null };
}

/** Kharagpur orders approved in ERP that we do not have yet. They come with no lot and Supply from blank. */
export function newOrders(sfg: SfgOrder[], known: Set<string>) {
  return sfg
    // CR-B-07: never ABJ Syndicates.
    .filter((o) => o.prodOrder.startsWith(KGP_SERIES) && !known.has(o.prodOrder) && /^yes$/i.test(o.approved ?? "") && !/ABJ/i.test(o.party ?? ""))
    .map((o) => ({ prodOrder: o.prodOrder, mcNo: o.mcNo, party: o.party, cable: o.fgItem, orderDate: o.orderDate, approved: o.approved, ...parseFgItem(o.fgItem), addedAt: new Date() }));
}

/** Calculated lot columns, and Closed once an approved lot sent to the plant has nothing left. */
export function lotTotals(lots: LotRow[], orders: ({ lotNo: string | null; pendingFrom: string | null } & Partial<Record<BalField, number | null>>)[]) {
  return lots.map((l) => {
    const mine = orders.filter((o) => o.lotNo === l.lotNo);
    const sum = (f: BalField) => r3(mine.reduce((a, o) => a + (o[f] ?? 0), 0));
    const done = mine.length > 0 && mine.every((o) => o.pendingFrom === "Done");
    return {
      lotNo: l.lotNo,
      data: {
        orders: mine.length,
        balanceKm: sum("finishBalKm"),
        conductorPendingCoreKm: sum("conductorBalCoreKm"),
        insulationPendingCoreKm: sum("insulationBalCoreKm"),
        ...(done && l.approvedByMd && l.sentToPlant && l.status === "Approved" ? { status: "Closed" } : {}),
      },
    };
  });
}

type SheetLot = { lotNo: string; runOrder: number; approvedByMd: boolean; sentToPlant?: boolean | null };
type SheetOrder = { prodOrder: string; lotNo: string | null; runOrderInLot: number | null; supplyFrom: string | null; finishBalKm?: number | null };

/** Side-by-side check during the cutover: every place the sheet and the dashboard disagree. */
export function compareSheet(sheet: { lots: SheetLot[]; orders: SheetOrder[] }, ours: { lots: SheetLot[]; orders: SheetOrder[] }): string[] {
  const out: string[] = [];
  const diff = <T, K extends keyof T>(label: string, id: string, a: T, b: T, keys: [K, string][]) => {
    for (const [k, name] of keys) if ((a[k] ?? null) !== (b[k] ?? null)) out.push(`${label} ${id} ${name}: sheet ${a[k] ?? "blank"}, dashboard ${b[k] ?? "blank"}`);
  };
  const ourLots = new Map(ours.lots.map((l) => [l.lotNo, l]));
  for (const l of sheet.lots) {
    const o = ourLots.get(l.lotNo);
    if (!o) out.push(`Lot ${l.lotNo}: in the sheet only`);
    else diff("Lot", l.lotNo, l, o, [["runOrder", "run order"], ["approvedByMd", "approved by MD"], ["sentToPlant", "sent to plant"]]);
    ourLots.delete(l.lotNo);
  }
  for (const l of ourLots.keys()) out.push(`Lot ${l}: in the dashboard only`);
  const ourOrders = new Map(ours.orders.map((o) => [o.prodOrder, o]));
  for (const s of sheet.orders) {
    const o = ourOrders.get(s.prodOrder);
    if (!o) out.push(`Order ${s.prodOrder}: in the sheet only`);
    else {
      diff("Order", s.prodOrder, s, o, [["lotNo", "lot"], ["runOrderInLot", "run order"], ["supplyFrom", "supply from"]]);
      if (Math.abs((s.finishBalKm ?? 0) - (o.finishBalKm ?? 0)) > 0.05) out.push(`Order ${s.prodOrder} finish balance: sheet ${s.finishBalKm ?? 0}, dashboard ${o.finishBalKm ?? 0}`);
    }
    ourOrders.delete(s.prodOrder);
  }
  for (const o of ourOrders.keys()) out.push(`Order ${o}: in the dashboard only`);
  return out;
}

const str = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Updates one lot or order and logs each field that changed. Returns false when there is no such row. */
export async function changeClub(db: Pick<PrismaClient, "$transaction">, by: string, tbl: "lot" | "order", key: string, data: Record<string, unknown>) {
  const set = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  return db.$transaction(async (tx) => {
    const before = (tbl === "lot" ? await tx.kgpLot.findUnique({ where: { lotNo: key } }) : await tx.kgpOrder.findUnique({ where: { prodOrder: key } })) as Record<string, unknown> | null;
    if (!before) return false;
    if (tbl === "lot") await tx.kgpLot.update({ where: { lotNo: key }, data: set });
    else await tx.kgpOrder.update({ where: { prodOrder: key }, data: set });
    const changed = Object.entries(set).filter(([f, v]) => str(before[f]) !== str(v));
    if (changed.length) await tx.clubChange.createMany({ data: changed.map(([field, v]) => ({ by, tbl, key, field, oldValue: str(before[field]), newValue: str(v) })) });
    return true;
  });
}

/**
 * Approved by MD on one lot (the MD's decision, CR-C-13): approving moves the status Draft -> Approved; taking it
 * back moves it to Draft and clears Sent to plant. Callers check the admin role. Returns the reason when it cannot.
 */
export async function approveLot(db: Pick<PrismaClient, "$transaction" | "kgpLot">, by: string, lotNo: string, approve: boolean) {
  const lot = await db.kgpLot.findUnique({ where: { lotNo }, select: { status: true } });
  if (!lot) return `No lot ${lotNo}.`;
  if (lot.status === "Closed") return `Lot ${lotNo} is closed.`;
  await changeClub(db, by, "lot", lotNo, { approvedByMd: approve, status: approve ? "Approved" : "Draft", ...(approve ? {} : { sentToPlant: false }) });
  return null;
}

/** Hourly refresh once the dashboard is the master. Runs inside the sync's transaction. */
export async function refreshClub(tx: Prisma.TransactionClient, lines: Line[], sfg: SfgOrder[]) {
  // Orders the MD removed are not brought back (plan 1.2: removed only on the MD's word).
  const removed = (await tx.clubChange.findMany({ where: { tbl: "order", field: "removed" }, select: { key: true } })).map((c) => c.key);
  const known = new Set([...(await tx.kgpOrder.findMany({ select: { prodOrder: true } })).map((o) => o.prodOrder), ...removed]);
  const added = newOrders(sfg, known);
  const unapproved = sfg.filter((o) => o.prodOrder.startsWith(KGP_SERIES) && !known.has(o.prodOrder) && !/^yes$/i.test(o.approved ?? ""));
  const value = unapproved.map((o) => ({ prodOrder: o.prodOrder, party: o.party, cable: o.fgItem, orderDate: o.orderDate?.toISOString().slice(0, 10) ?? null }));
  await tx.setting.upsert({ where: { key: CLUB_UNAPPROVED }, create: { key: CLUB_UNAPPROVED, value, updatedBy: "sync" }, update: { value, updatedBy: "sync" } });
  if (added.length) {
    await tx.kgpOrder.createMany({ data: added });
    await tx.clubChange.createMany({ data: added.map((o) => ({ by: "sync", tbl: "order", key: o.prodOrder, field: "added", newValue: `${o.party ?? ""} · ${o.cable ?? ""}` })) });
  }
  const orders = await tx.kgpOrder.findMany();
  for (const u of refreshOrders(orders, lines)) {
    await tx.kgpOrder.update({ where: { prodOrder: u.prodOrder }, data: { ...u.data, toConfirm: u.data.toConfirm ?? Prisma.DbNull } });
    // The day an order is finished is its actual FG ready date (plan 4g: promise vs actual).
    const was = orders.find((o) => o.prodOrder === u.prodOrder)!;
    if (u.data.pendingFrom === "Done" && was.pendingFrom !== "Done") await tx.clubChange.create({ data: { by: "sync", tbl: "order", key: u.prodOrder, field: "finished", oldValue: was.pendingFrom, newValue: "Done" } });
  }
  const fresh = await tx.kgpOrder.findMany();
  const lots = await tx.kgpLot.findMany();
  for (const u of lotTotals(lots, fresh)) {
    const was = lots.find((l) => l.lotNo === u.lotNo)!;
    await tx.kgpLot.update({ where: { lotNo: u.lotNo }, data: u.data });
    if (u.data.status && u.data.status !== was.status) await tx.clubChange.create({ data: { by: "sync", tbl: "lot", key: u.lotNo, field: "status", oldValue: was.status, newValue: u.data.status } });
  }
  return { added: added.length, toConfirm: fresh.filter((o) => o.toConfirm).length };
}
