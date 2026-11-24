"use server";

import { changed } from "@/lib/cached";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildCards } from "@/lib/cards/load";
import { CLUB_MASTER } from "@/lib/club/club";

/** Sync every connected sheet now, as the scheduled job does (a new card revision only if the cards changed). Admins only. */
export async function syncNow(): Promise<string | null> {
  if ((await auth())?.user?.role !== "admin") return "Only an admin can start a sync. Sign in again.";
  try {
    await buildCards(db, { ifChanged: true });
  } catch (e) {
    // The sheets may still have been read and stored before the cards failed: show the new times anyway.
    changed();
    return (e as Error).message;
  }
  changed();
  return null;
}

/**
 * Cutover: Club & Run is kept in the dashboard from now on, starting from the sheet's last sync. Later syncs only
 * refresh balances from SFG, add new Kharagpur orders and list where the sheet differs. Admins only.
 */
export async function makeDashboardMaster(): Promise<string | null> {
  const user = (await auth())?.user;
  if (user?.role !== "admin") return "Only an admin can do this. Sign in again.";
  const lots = await db.kgpLot.count();
  if (!lots) return "No lots stored yet: sync from the sheet first.";
  await db.setting.upsert({
    where: { key: CLUB_MASTER },
    create: { key: CLUB_MASTER, value: "dashboard", description: "Club & Run is kept in the dashboard, not the sheet", updatedBy: user.email },
    update: { value: "dashboard", updatedBy: user.email },
  });
  changed();
  return null;
}
