import { connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { life } from "@/lib/cached";
import { Prisma } from "@/lib/generated/prisma/client";
import { CLUB_COMPARE, CLUB_MASTER } from "@/lib/club/club";
import { ClubRunHeader } from "../_header";
import { AcceptSfgButton } from "../_controls";
import { editClubLot, editClubOrder } from "../actions";
import { ServerTable } from "@/components/dash/server-table";
import { Panel } from "@/components/ui/panel";

// Club & Run lots and orders. Kept here once the dashboard is the master; until then, as the sync last stored the sheet.
export const metadata = { title: "Club & Run – Lots & orders" };
export const instant = false;

async function lotsData() {
  "use cache: remote";
  life();
  return Promise.all([
    db.setting.findUnique({ where: { key: CLUB_MASTER } }),
    db.setting.findUnique({ where: { key: CLUB_COMPARE } }),
    db.kgpOrder.findMany({ where: { toConfirm: { not: Prisma.DbNull } }, select: { prodOrder: true, party: true, toConfirm: true }, orderBy: { prodOrder: "asc" } }),
  ]);
}

export default async function ClubRunLotsPage() {
  await connection();
  // The actions check the role again: admin = MD's rights, plant = Sent to plant only.
  const [session, [master, compare, toConfirm]] = await Promise.all([auth(), lotsData()]);
  const role = session?.user?.role;
  const isMaster = master?.value === "dashboard";
  const cmp = compare?.value as { at: string; diffs: string[] } | undefined;
  return (
    <>
      <ClubRunHeader active="/club-run/lots" />
      {/* Block flow, not grid: a grid item widens to its table, so the table's own sideways scroll never starts. */}
      <main className="w-full flex-1 space-y-6 px-4 pb-16 pt-8 sm:px-6">
        <p className="text-label text-ink-2">
          {isMaster ? "Kept in the dashboard. SFG refreshes balances and adds new Kharagpur orders every sync." : "Copied from the Club & Run sheet on every sync. Changes here are lost at the next sync."}
        </p>
        {toConfirm.length > 0 && (
          <Panel id="to-confirm" title="To confirm" subtitle="SFG figures far from ours. Ours are kept until the MD accepts" glyph="list">
            <ul className="space-y-2">
              {toConfirm.map((o) => (
                <li key={o.prodOrder} className="flex flex-wrap items-center gap-3 text-label">
                  <span className="num">{o.prodOrder}</span>
                  <span className="text-ink-2">{o.party}</span>
                  <span className="num text-ink-2">{Object.entries(o.toConfirm as Record<string, number>).map(([k, v]) => `${k} → ${v}`).join(", ")}</span>
                  {role === "admin" && <AcceptSfgButton prodOrder={o.prodOrder} />}
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {isMaster && cmp && (
          <Panel id="compare" title="Sheet vs dashboard" subtitle={`Checked ${new Date(cmp.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · ${cmp.diffs.length ? `${cmp.diffs.length} differences` : "all match"}`} glyph="list">
            {cmp.diffs.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-label">
                {cmp.diffs.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        {/* The tables are plant-wide; the machine code only satisfies the shared table API. */}
        <Panel id="lots" title="Lots" subtitle="Clubbed lots in run order, with the MD's approval" glyph="layers">
          <ServerTable name="club-lots" machineCode="KGP" edit={role === "admin" || role === "plant" ? { key: "lotNo", save: editClubLot } : undefined} />
        </Panel>
        <Panel id="orders" title="Orders" subtitle="Every order with its stage balances (from SFG) and lot" glyph="list">
          <ServerTable name="club-orders" machineCode="KGP" edit={role === "admin" ? { key: "prodOrder", save: editClubOrder } : undefined} />
        </Panel>
      </main>
    </>
  );
}
