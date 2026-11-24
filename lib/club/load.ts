// Loads everything the Club & Run plan view, lot checks and new-order inbox need, in one place.
import type { PrismaClient } from "../generated/prisma/client.ts";
import { dayOf, expectedDates, lotViews, profileOf, type Eta, type LineIn, type PlanIn, type Profile } from "./insight.ts";

/** Today in plant time (IST). */
export const plantToday = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export async function loadClub(db: PrismaClient, now = new Date()) {
  const today = plantToday(now);
  const [orders, lots, lines, issue] = await Promise.all([
    db.kgpOrder.findMany(),
    db.kgpLot.findMany({ orderBy: { runOrder: "asc" } }),
    db.kgpOrderLine.findMany({ select: { prodOrder: true, fgType: true, stage: true, sfgItem: true, netQty: true, doneQty: true, balance: true, sfgBom: true } }),
    db.cardIssue.findFirst({ orderBy: [{ issueDate: "desc" }, { rev: "desc" }], select: { id: true, version: true, d0: true, s8PulledAt: true, loadedAt: true } }),
  ]);
  const boms = [...new Set(lines.filter((l) => l.stage === "ARMOURING" && l.sfgBom).map((l) => l.sfgBom!))];
  const [armourRows, planRows, drumRows] = await Promise.all([
    db.bomLine.findMany({ where: { sfgBom: { in: boms }, OR: [{ material: { contains: "STRIP", mode: "insensitive" } }, { material: { contains: "WIRE", mode: "insensitive" } }] }, select: { sfgBom: true, material: true } }),
    issue ? db.cardPlan.findMany({ where: { issueId: issue.id }, orderBy: { rowNo: "asc" } }) : Promise.resolve([]),
    issue ? db.cardDrumNeed.findMany({ where: { issueId: issue.id }, select: { prodOrder: true, drumSize: true, drumsNeeded: true, fromStock: true, toAssemble: true, late: true } }) : Promise.resolve([]),
  ]);
  // A wire-rod line is not armour: keep strip and armour-wire materials only.
  const armourOf = new Map(armourRows.filter((r) => !/ROD/i.test(r.material)).map((r) => [r.sfgBom, r.material]));
  const plan: PlanIn[] = planRows.map((r) => ({ ...r, day: r.day.toISOString().slice(0, 10) }));
  const profiles = new Map<string, Profile>(orders.map((o) => [o.prodOrder, profileOf(o.prodOrder, lines as LineIn[], armourOf, o.finishBalKm ?? 0)]));
  const etas: Map<string, Eta> = expectedDates(orders, lots, profiles, plan, today);
  const views = lotViews(lots, orders, profiles, etas, plan, today);
  return { today, orders, lots, lines: lines as LineIn[], plan, drums: drumRows, issue, profiles, etas, views };
}

export type ClubData = Awaited<ReturnType<typeof loadClub>>;

/** The latest snapshot of expected FG dates before today, so the page can show how far each date moved (plan 3.7). */
export async function prevEtas(db: PrismaClient, today: string) {
  const prevDay = await db.clubEta.findFirst({ where: { day: { lt: new Date(today) } }, orderBy: { day: "desc" }, select: { day: true } });
  const prev = prevDay ? await db.clubEta.findMany({ where: { day: prevDay.day } }) : [];
  return new Map(prev.map((p) => [p.prodOrder, dayOf(p.fgReady)]));
}

/** Stores today's expected FG dates once a day; later calls the same day change nothing. */
export async function storeEtas(db: PrismaClient, today: string, etas: Map<string, Eta>) {
  if (!etas.size || (await db.clubEta.count({ where: { day: new Date(today) } }))) return;
  await db.clubEta.createMany({
    data: [...etas.values()].map((e) => ({ day: new Date(today), prodOrder: e.prodOrder, fgReady: e.fgReady ? new Date(e.fgReady) : null, estimated: e.estimated })),
    skipDuplicates: true,
  });
}
