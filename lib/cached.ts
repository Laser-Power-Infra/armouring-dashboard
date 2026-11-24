// Cached reads for the pages. The data only changes through a sync, a dashboard decision or an MCP tool, and every
// one of those clears the tag, so pages read the database once per change instead of on every view.
// 'use cache: remote' keeps one copy shared by every server instance (in-memory would miss on each new instance).
import { cacheLife, cacheTag, refresh, revalidateTag, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { getCard1Sources, getCardPlan, getDrums, getIssues, getLabour } from "@/lib/cards/data";
import { isStock } from "@/lib/club/insight";
import { loadClub, plantToday, prevEtas } from "@/lib/club/load";

const TAG = "db";

/** Call first inside every cached read: tagged for clearing, and never older than 30 minutes. */
export function life() {
  cacheTag(TAG);
  cacheLife({ stale: 60, revalidate: 1500, expire: 1800 });
}

/** Server actions, after a write: drop the cached reads and re-render the page with fresh data. */
export function changed() {
  updateTag(TAG);
  refresh();
}

/** Route handlers (sync job, MCP), after a write: the next page view reads fresh data. */
export const changedOutside = () => revalidateTag(TAG, { expire: 0 });

/** Everything the Club & Run views need, plus yesterday's FG dates for the "moved" column. */
export async function clubData() {
  "use cache: remote";
  life();
  const [club, prev] = await Promise.all([loadClub(db), prevEtas(db, plantToday())]);
  return { ...club, prev };
}

/** Orders waiting for the MD's decision: in no lot, not held, not given from stock, with work left at Kharagpur. */
export async function inboxCount() {
  "use cache: remote";
  life();
  const open = await db.kgpOrder.findMany({ where: { lotNo: null, onHold: false, NOT: { pendingFrom: "Done" } }, select: { supplyFrom: true } });
  return open.filter((o) => !isStock(o)).length;
}

export async function cachedIssues() {
  "use cache: remote";
  life();
  return getIssues(db);
}

export async function cachedCardPlan(issueId: number) {
  "use cache: remote";
  life();
  return getCardPlan(db, issueId);
}

export async function cachedCard1Sources() {
  "use cache: remote";
  life();
  return getCard1Sources(db);
}

export async function cachedDrums(issueId: number) {
  "use cache: remote";
  life();
  return getDrums(db, issueId);
}

export async function cachedLabour(issueId: number) {
  "use cache: remote";
  life();
  return getLabour(db, issueId);
}
