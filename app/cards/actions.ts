"use server";

import { changed } from "@/lib/cached";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildCards } from "@/lib/cards/load";

/** Syncs every source table and stores a new revision of today's four cards. Returns the reason when it cannot. */
export async function regenerateCards(_prev: string | null, note: string): Promise<string | null> {
  try {
    await buildCards(db, { note: String(note ?? "").slice(0, 500) });
  } catch (e) {
    // The sheets may still have been read and stored before the cards failed.
    changed();
    return (e as Error).message;
  }
  changed();
  redirect("/cards/production"); // the new revision is the latest
}

/** The issue is confirmed: its pages stop printing the review mark. */
export async function confirmIssue(id: number) {
  if (!Number.isInteger(id)) return;
  await db.cardIssue.update({ where: { id }, data: { review: false } });
  changed();
}
