import { connection } from "next/server";
import { ClubRunHeader } from "./_header";
import { ServerTable } from "@/components/dash/server-table";
import { Panel } from "@/components/ui/panel";

// The whole Club & Run sheet (Lots and Orders tabs), as the cards sync last stored it.
export const metadata = { title: "Club & Run" };
export const instant = false;

export default async function ClubRunPage() {
  await connection();
  return (
    <>
      <ClubRunHeader active="/club-run" />
      {/* Block flow, not grid: a grid item widens to its table, so the table's own sideways scroll never starts. */}
      <main className="w-full flex-1 space-y-6 px-4 pb-16 pt-8 sm:px-6">
        {/* The tables are plant-wide; the machine code only satisfies the shared table API. */}
        <Panel id="lots" title="Lots" subtitle="Clubbed lots in run order, with the MD's approval" glyph="layers">
          <ServerTable name="club-lots" machineCode="KGP" />
        </Panel>
        <Panel id="orders" title="Orders" subtitle="Every order on the Club & Run sheet, with its stage balances and lot" glyph="list">
          <ServerTable name="club-orders" machineCode="KGP" />
        </Panel>
      </main>
    </>
  );
}
