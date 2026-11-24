"use server";

import { changed } from "@/lib/cached";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { approveLot, changeClub, pendingFrom, SUPPLY_FROM } from "@/lib/club/club";
import { failed, isStock, lotChecks, newLotDate, suggestLots } from "@/lib/club/insight";
import { loadClub, plantToday } from "@/lib/club/load";

const yesNo = (v: string) => (v === "true" ? true : v === "false" ? false : null);

/**
 * One dropdown change on the Club & Run Lots table. Admin (the MD's rights): Approved by MD, which also moves the
 * status Draft <-> Approved. Plant: Sent to plant, only once the MD has approved. Every change is logged.
 * Returns the reason when it cannot save.
 */
export async function editClubLot(lotNo: string, key: string, value: string): Promise<string | null> {
  const user = (await auth())?.user;
  const role = user?.role;
  const v = yesNo(value);
  if (v === null) return `Cannot set ${key} to "${value}".`;
  const lot = await db.kgpLot.findUnique({ where: { lotNo: String(lotNo) } });
  if (!lot) return `No lot ${lotNo}.`;
  let data: Record<string, unknown>;
  if (key === "approvedByMd") {
    if (role !== "admin") return "Only the MD can approve a lot.";
    const why = await approveLot(db, user!.email ?? "unknown", lot.lotNo, v);
    if (!why) changed();
    return why;
  } else if (key === "sentToPlant") {
    if (role !== "admin" && role !== "plant") return "Only the plant or the MD can tick Sent to plant.";
    if (v && !lot.approvedByMd) return `Lot ${lotNo} is not approved by the MD yet.`;
    data = { sentToPlant: v };
  } else return `${key} cannot be changed here.`;
  await changeClub(db, user!.email ?? "unknown", "lot", lot.lotNo, data);
  changed();
  return null;
}

/** Supply from on the Orders table: the MD's decision only. */
export async function editClubOrder(prodOrder: string, key: string, value: string): Promise<string | null> {
  const user = (await auth())?.user;
  if (user?.role !== "admin") return "Only the MD can change an order.";
  if (key !== "supplyFrom" || !(SUPPLY_FROM as readonly string[]).includes(value)) return `Cannot set ${key} to "${value}".`;
  if (!(await changeClub(db, user.email ?? "unknown", "order", String(prodOrder), { supplyFrom: value }))) return `No order ${prodOrder}.`;
  changed();
  return null;
}

/** The MD takes the SFG figures that were held back as too different from ours. */
export async function acceptSfg(prodOrder: string): Promise<string | null> {
  const user = (await auth())?.user;
  if (user?.role !== "admin") return "Only the MD can accept SFG figures.";
  const o = await db.kgpOrder.findUnique({ where: { prodOrder } });
  if (!o?.toConfirm) return `Nothing to confirm on ${prodOrder}.`;
  const sfg = o.toConfirm as Record<string, number>;
  await changeClub(db, user.email ?? "unknown", "order", prodOrder, { ...sfg, pendingFrom: pendingFrom({ ...o, ...sfg }) });
  await db.kgpOrder.update({ where: { prodOrder }, data: { toConfirm: Prisma.DbNull } });
  changed();
  return null;
}

// ── Lot decisions (plan 1.4, 4e). The MD only (admin). Every write goes through changeClub, so it is logged. ──

const md = async () => {
  const user = (await auth())?.user;
  return user?.role === "admin" ? (user.email ?? "unknown") : null;
};
const NOT_MD = "Only the MD can do this.";

/** Moves a lot one place up (-1) or down (+1) in the run order, swapping with its neighbour. */
export async function moveLot(lotNo: string, dir: -1 | 1): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  const lots = await db.kgpLot.findMany({ orderBy: { runOrder: "asc" } });
  const i = lots.findIndex((l) => l.lotNo === lotNo);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= lots.length) return "Cannot move further.";
  const [a, b] = [lots[i], lots[j]];
  await changeClub(db, by, "lot", a.lotNo, { runOrder: b.runOrder });
  await changeClub(db, by, "lot", b.lotNo, { runOrder: a.runOrder });
  changed();
  return null;
}

/** Why an order cannot join a lot, or what joining gives. Urgent (CR-G-40): may join a running lot with the same armour. */
async function checkJoin(prodOrder: string, lotNo: string | null, urgent: boolean) {
  const d = await loadClub(db);
  const o = d.orders.find((x) => x.prodOrder === prodOrder);
  if (!o) return { error: `No order ${prodOrder}.` };
  const p = d.profiles.get(prodOrder)!;
  const view = lotNo ? d.views.find((v) => v.lotNo === lotNo) : undefined;
  if (lotNo && !view) return { error: `No lot ${lotNo}.` };
  const members = lotNo ? d.orders.filter((x) => x.lotNo === lotNo && x.prodOrder !== prodOrder && !isStock(x)).map((x) => d.profiles.get(x.prodOrder)!) : [];
  // A new lot has no running lot to wait for: CR-E-22 is shown, not enforced (left for the MD to rule on).
  const checks = lotChecks(p, members, view?.state === "RUNNING").map((c) => (!lotNo && c.code === "CR-E-22" ? { ...c, blocking: false } : c));
  const fails = failed(checks);
  if (fails.length && !urgent) return { error: `Not added. Failed: ${fails.map((c) => `${c.code} ${c.label} (order ${c.order}, lot ${c.lot})`).join("; ")}. Only an urgent order may be overridden.` };
  if (fails.length && urgent) {
    const armourOk = !members[0] || (p.armour ?? "") === (members[0].armour ?? "");
    if (view?.state !== "RUNNING" || !armourOk || !p.armour) return { error: "Urgent orders may join only a running lot with the same, confirmed armour (CR-G-40, CR-G-41)." };
  }
  const fg = lotNo ? suggestLots(p, d.views, d.orders, d.profiles, d.etas, 99).find((s) => s.lotNo === lotNo)?.fgReady : newLotDate(p, d.views, d.today);
  return { o, fails, fg: fg ?? null, top: suggestLots(p, d.views, d.orders, d.profiles, d.etas, 1)[0]?.lotNo ?? "new lot" };
}

const withRemark = (old: string | null, add: string) => [old, add].filter(Boolean).join(" · ");

/** Puts an order in a lot, at the end of the lot, after the checks pass (CR-E-30, CR-E-33). */
export async function addToLot(prodOrder: string, lotNo: string, urgent = false): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  const r = await checkJoin(prodOrder, lotNo, urgent);
  if ("error" in r) return r.error ?? null;
  const last = await db.kgpOrder.aggregate({ where: { lotNo }, _max: { runOrderInLot: true } });
  await changeClub(db, by, "order", prodOrder, {
    lotNo,
    runOrderInLot: (last._max.runOrderInLot ?? 0) + 1,
    onHold: false,
    urgent,
    suggestedLot: r.top,
    promisedOn: r.fg ? new Date(r.fg) : null,
    ...(urgent && r.fails.length ? { remarks: withRemark(r.o.remarks, `Urgent, differs from ${lotNo} on: ${r.fails.map((c) => `${c.label} (${c.order} vs ${c.lot})`).join(", ")}`) } : {}),
  });
  changed();
  return null;
}

/** Makes a new Draft lot (next PL number, last in run order) holding this order. */
export async function newLotFor(prodOrder: string): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  const r = await checkJoin(prodOrder, null, false);
  if ("error" in r) return r.error ?? null;
  const lots = await db.kgpLot.findMany({ select: { lotNo: true, runOrder: true } });
  const n = Math.max(0, ...lots.map((l) => Number(/(\d+)$/.exec(l.lotNo)?.[1] ?? 0))) + 1;
  const lotNo = `PL-${String(n).padStart(3, "0")}`;
  await db.kgpLot.create({ data: { lotNo, runOrder: Math.max(0, ...lots.map((l) => l.runOrder)) + 1, approvedByMd: false, sentToPlant: false, status: "Draft", created: new Date(plantToday()), whatClubbed: r.o.cable } });
  await db.clubChange.create({ data: { by, tbl: "lot", key: lotNo, field: "created", newValue: `for ${prodOrder}` } });
  await changeClub(db, by, "order", prodOrder, { lotNo, runOrderInLot: 1, onHold: false, suggestedLot: r.top, promisedOn: r.fg ? new Date(r.fg) : null });
  changed();
  return null;
}

/** Supply from dead / old / free stock instead of making it. */
export async function supplyFromStock(prodOrder: string, from: string): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  if (!["Dead stock", "Old stock", "Free stock"].includes(from)) return `Cannot supply from "${from}".`;
  if (!(await changeClub(db, by, "order", prodOrder, { supplyFrom: from, onHold: false }))) return `No order ${prodOrder}.`;
  changed();
  return null;
}

/** Holds an order out of the inbox ("Rok do"), or releases it. */
export async function holdOrder(prodOrder: string, hold: boolean): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  if (!(await changeClub(db, by, "order", prodOrder, { onHold: hold }))) return `No order ${prodOrder}.`;
  changed();
  return null;
}

/** Takes an order out of its lot; it goes back to the inbox. */
export async function takeOutOfLot(prodOrder: string): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  if (!(await changeClub(db, by, "order", prodOrder, { lotNo: null, runOrderInLot: null }))) return `No order ${prodOrder}.`;
  changed();
  return null;
}

/** The customer's delivery date for an order (YYYY-MM-DD; blank clears it). */
export async function setCustomerDate(prodOrder: string, date: string): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Give the date as YYYY-MM-DD.";
  if (!(await changeClub(db, by, "order", prodOrder, { customerDate: date ? new Date(date) : null }))) return `No order ${prodOrder}.`;
  changed();
  return null;
}

/**
 * Removes an order with nothing left at Kharagpur and in no lot (plan 1.2: only on the MD's word). The whole row is
 * kept in the change log, and the sync does not bring it back.
 */
export async function removeOrder(prodOrder: string): Promise<string | null> {
  const by = await md();
  if (!by) return NOT_MD;
  const o = await db.kgpOrder.findUnique({ where: { prodOrder } });
  if (!o) return `No order ${prodOrder}.`;
  if (o.lotNo || o.pendingFrom !== "Done") return `${prodOrder} still has work at Kharagpur or is in a lot.`;
  await db.$transaction([
    db.clubChange.create({ data: { by, tbl: "order", key: prodOrder, field: "removed", oldValue: JSON.stringify(o) } }),
    db.kgpOrder.delete({ where: { prodOrder } }),
  ]);
  changed();
  return null;
}
