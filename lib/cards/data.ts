// Reads stored card issues. The client is passed in so the same code serves the pages and the tests.
import type { PrismaClient } from "../generated/prisma/client.ts";
import { ddMonYy } from "./calendar.ts";
import type { Day, DrumAssemblyRow, DrumNeedRow, DrumStockRow, LabourRow, PlanRow, SpareRow } from "./sheet.ts";

export type Issue = { id: number; version: string; issueDate: Day; rev: number; d0: Day; loadedAt: Date; /** Set on issues built in the app. */ s8PulledAt: string | null; notPlanned: string[]; prevIssueId: number | null; issueNote: string; /** Not confirmed yet: every page prints the review mark. */ review: boolean; rosterName: string | null; labourProblem: string | null; drumProblem: string | null };

type Db = Pick<PrismaClient, "cardIssue" | "cardPlan" | "cardLabour" | "cardSpareMen" | "cardDrumNeed" | "cardDrumAssembly" | "cardDrumStock">;
const day = (d: Date): Day => d.toISOString().slice(0, 10);
const order = { orderBy: { rowNo: "asc" } } as const;

/** "17-Nov-26 / Rev 2" */
export const issueName = (i: Pick<Issue, "issueDate" | "rev">) => `${ddMonYy(i.issueDate)} / Rev ${i.rev}`;
/** The text in the version box of every card page. */
export const versionLabel = (i: Pick<Issue, "issueDate" | "rev">) => `VERSION ${issueName(i)}`;

/** Every stored issue, newest first. */
export async function getIssues(db: Db): Promise<Issue[]> {
  const rows = await db.cardIssue.findMany({ orderBy: [{ issueDate: "desc" }, { rev: "desc" }] });
  return rows.map((r) => ({ id: r.id, version: r.version, issueDate: day(r.issueDate), rev: r.rev, d0: day(r.d0), loadedAt: r.loadedAt, s8PulledAt: r.s8PulledAt, notPlanned: r.notPlanned, prevIssueId: r.prevIssueId, issueNote: r.issueNote, review: r.review, rosterName: r.rosterName, labourProblem: r.labourProblem, drumProblem: r.drumProblem }));
}

export async function getCardPlan(db: Db, issueId: number): Promise<PlanRow[]> {
  const [issue, rows] = await Promise.all([db.cardIssue.findUniqueOrThrow({ where: { id: issueId } }), db.cardPlan.findMany({ where: { issueId }, ...order })]);
  return rows.map((r) => ({ ...r, version: issue.version, day: day(r.day), feedStatus: r.feedStatus as PlanRow["feedStatus"] }));
}

export async function getLabour(db: Db, issueId: number): Promise<{ labour: LabourRow[]; spare: SpareRow[] }> {
  const [labour, spare] = await Promise.all([db.cardLabour.findMany({ where: { issueId }, ...order }), db.cardSpareMen.findMany({ where: { issueId }, orderBy: [{ day: "asc" }, { shift: "asc" }] })]);
  return {
    labour: labour.map((r) => ({ ...r, version: "", day: day(r.day), shift: r.shift as LabourRow["shift"] })),
    spare: spare.map((r) => ({ version: "", day: day(r.day), shift: r.shift as SpareRow["shift"], men: r.men })),
  };
}

export async function getDrums(db: Db, issueId: number): Promise<{ need: DrumNeedRow[]; assembly: DrumAssemblyRow[]; stock: DrumStockRow[] }> {
  const [need, assembly, stock] = await Promise.all([
    db.cardDrumNeed.findMany({ where: { issueId }, ...order }),
    db.cardDrumAssembly.findMany({ where: { issueId }, ...order }),
    db.cardDrumStock.findMany({ where: { issueId } }),
  ]);
  return {
    need: need.map((r) => ({ ...r, version: "", usedOn: day(r.usedOn), readyBy: day(r.readyBy) })),
    assembly: assembly.map((r) => ({ ...r, version: "", assembleBy: day(r.assembleBy), was: r.was ? day(r.was) : null, usedOn: day(r.usedOn) })),
    stock,
  };
}

/**
 * What Card 1 prints beside the plan: men per shift (S4), planning stock by material name (S3, through the BOM's codes),
 * approved lots, and the FG drum of each order (RM Requirement sheet, as of the last sync).
 */
export async function getCard1Sources(db: Pick<PrismaClient, "machineMen" | "rmStock" | "bomLine" | "kgpLot" | "raccoonDrum">) {
  const [men, rm, bom, approvedLots, drums] = await Promise.all([
    db.machineMen.findMany(),
    db.rmStock.findMany(),
    db.bomLine.findMany({ distinct: ["material"], select: { material: true, materialCode: true } }),
    db.kgpLot.count({ where: { approvedByMd: true } }),
    db.raccoonDrum.findMany(),
  ]);
  const qty = new Map(rm.map((r) => [r.itemCode, r.qtyForPlanning]));
  return {
    men: new Map(men.map((m) => [m.machine, m.menPerShift])),
    stock: new Map(bom.flatMap((b) => (qty.has(b.materialCode) ? [[b.material, qty.get(b.materialCode)!] as const] : []))),
    approvedLots,
    drums: new Map(drums.map((d) => [d.prodOrder, d])),
  };
}
