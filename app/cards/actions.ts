"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildCard1 } from "@/lib/cards/load";

/** Syncs every source table and stores a new revision of today's Card 1. Returns the reason when it cannot. */
export async function regenerateCard1(): Promise<string | null> {
  try {
    await buildCard1(db);
  } catch (e) {
    return (e as Error).message;
  }
  redirect("/cards/production"); // the new revision is the latest
}
