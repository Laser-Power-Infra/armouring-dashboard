import { connection } from "next/server";
import { MainNav } from "@/components/dash/main-nav";
import { Panel } from "@/components/ui/panel";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { SHEETS } from "@/lib/cards/sources";
import { ROSTER_TITLE, S6, S10 } from "@/lib/cards/build-labour";
import { DRUM_SHEETS } from "@/lib/cards/build-drums";

// Every Google Sheet the sync reads, and when each was last read without error (sync_runs).
export const metadata = { title: "Connectors" };
export const instant = false;

const sheet = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

export default async function ConnectorsPage() {
  await connection();
  const [last, roster] = await Promise.all([
    db.syncRun.groupBy({ by: ["source"], where: { ok: true }, _max: { at: true } }),
    db.syncRun.findFirst({ where: { source: "S5", ok: true }, orderBy: { at: "desc" }, select: { tab: true } }),
  ]);
  const at = new Map(last.map((r) => [r.source, r._max.at]));
  const sources = [
    { code: "S1", name: SHEETS.S1.name, href: sheet(SHEETS.S1.id), use: "Club & Run lots and orders" },
    { code: "S3", name: SHEETS.S3.name, href: sheet(SHEETS.S3.id), use: "Raw material stock" },
    { code: "S4", name: SHEETS.S4.name, href: sheet(SHEETS.S4.id), use: "Machines and men per shift" },
    // The roster's ID changes with every revision: the sync takes the newest sheet with this text in its title.
    { code: "S5", name: roster?.tab ?? `Newest sheet titled “${ROSTER_TITLE}”`, href: `https://drive.google.com/drive/search?q=${encodeURIComponent(ROSTER_TITLE)}`, use: "Machine roster" },
    { code: "S6", name: S6.name, href: sheet(S6.id), use: "Skills" },
    { code: "S7", name: DRUM_SHEETS.S7.name, href: sheet(DRUM_SHEETS.S7.id), use: "Drum stock" },
    { code: "S8", name: SHEETS.S8.name, href: sheet(SHEETS.S8.id), use: "Order lines, material per item, drum lengths" },
    { code: "S10", name: S10.name, href: sheet(S10.id), use: "Punch blocked list" },
  ];
  const cell = "h-11 border-b border-r border-line-2 px-3";
  const head = "h-9 whitespace-nowrap border-b border-r border-line-2 bg-ground px-3 text-caption font-normal text-ink-2";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line-2 bg-surface">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <span className="hidden text-body font-semibold sm:inline">Kharagpur</span>
          <MainNav active="/connectors" />
        </div>
      </header>
      <main className="w-full flex-1 space-y-6 px-4 pb-16 pt-8 sm:px-6">
        <Panel id="connectors" title="Connected sheets" subtitle="Google Sheets the sync reads. Last refreshed is the last time a sheet was read without error (IST)." glyph="list">
          <div className="overflow-x-auto border-l border-t border-line-2">
            <table className="w-full border-separate border-spacing-0 text-left text-label">
              <thead>
                <tr>
                  <th className={head}>Sheet</th>
                  <th className={head}>Used for</th>
                  <th className={`${head} text-right`}>Last refreshed</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const t = at.get(s.code);
                  return (
                    <tr key={s.code} className="hover:bg-ground">
                      <td className={cell}>
                        <a href={s.href} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                          {s.name}
                        </a>
                      </td>
                      <td className={`${cell} text-ink-2`}>{s.use}</td>
                      <td className={`${cell} num whitespace-nowrap text-right`}>{t ? dateTime(t) : <span className="text-ink-3">Not read yet</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </>
  );
}
