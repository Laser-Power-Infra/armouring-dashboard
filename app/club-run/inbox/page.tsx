import { connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clubData, life } from "@/lib/cached";
import { dateTime, shortDay } from "@/lib/format";
import { CLUB_MASTER, CLUB_UNAPPROVED } from "@/lib/club/club";
import { failed, isStock, newLotDate, SMALL_KM, suggestLots, trafficJam, type Check } from "@/lib/club/insight";
import { ClubRunHeader } from "../_header";
import { ActionButton, CustomerDate, ReadAloudButton, StockPicker } from "../_controls";
import { addToLot, holdOrder, newLotFor, removeOrder } from "../actions";
import { Panel, Badge } from "@/components/ui/panel";
import { Empty } from "@/components/ui/feedback";

// New-order inbox (plan of 23-Nov, Part 4): every Kharagpur order without a decision, with stock, lot proposals and
// their checks, dates and effect on other lots. Only the MD decides.
export const metadata = { title: "Club & Run – New orders" };
export const instant = false;

const d = (s: string | null | undefined) => (s ? shortDay(s) : "–");

async function inboxData() {
  "use cache: remote";
  life();
  const [master, unapprovedSetting, finishLines, stockCount, changes] = await Promise.all([
    db.setting.findUnique({ where: { key: CLUB_MASTER } }),
    db.setting.findUnique({ where: { key: CLUB_UNAPPROVED } }),
    db.kgpOrderLine.findMany({ where: { stage: "FINISH" }, select: { prodOrder: true, sfgCode: true } }),
    db.stock.count(),
    db.clubChange.findMany({ where: { tbl: "order", field: { in: ["added", "lotNo", "supplyFrom", "onHold", "finished"] } }, orderBy: { at: "asc" } }),
  ]);
  const codes = [...new Set(finishLines.map((l) => l.sfgCode))];
  const stock = stockCount ? await db.stock.findMany({ where: { itemCode: { in: codes } } }) : [];
  return { master, unapprovedSetting, finishLines, stockCount, changes, stock };
}

export default async function ClubRunInboxPage() {
  await connection();
  const [session, data, { master, unapprovedSetting, finishLines, stockCount, changes, stock }] = await Promise.all([auth(), clubData(), inboxData()]);
  const isMd = session?.user?.role === "admin";
  const { orders, profiles, views, etas, lines, today } = data;
  const unapproved = (unapprovedSetting?.value ?? []) as { prodOrder: string; party: string | null; cable: string | null; orderDate: string | null }[];

  const inbox = orders.filter((o) => !o.lotNo && !o.onHold && !isStock(o) && profiles.get(o.prodOrder)?.pending !== "Done").sort((a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0) || a.prodOrder.localeCompare(b.prodOrder));
  const held = orders.filter((o) => o.onHold && !o.lotNo);
  const doneNoLot = orders.filter((o) => !o.lotNo && !isStock(o) && profiles.get(o.prodOrder)?.pending === "Done");
  const record = orders.filter((o) => o.addedAt || o.promisedOn);

  return (
    <>
      <ClubRunHeader active="/club-run/inbox" />
      <main className="w-full flex-1 space-y-6 px-4 pb-16 pt-6 sm:px-6">
        {master?.value !== "dashboard" && (
          <p role="status" className="rounded-panel border border-warning bg-warning-bg px-4 py-3 text-label text-warning">
            Club &amp; Run still comes from the Google Sheet: a decision made here is overwritten at the next sync. Switch on &quot;Keep Club &amp; Run in the dashboard&quot; on the Connectors page first.
          </p>
        )}

        <Panel id="inbox" title={`Waiting for the MD's decision (${inbox.length})`} subtitle="Kharagpur orders in no lot. Supply from is never filled in by the system." glyph="list">
          {!inbox.length && <Empty>No order is waiting.</Empty>}
          <div className="space-y-5">
            {inbox.map((o) => {
              const p = profiles.get(o.prodOrder)!;
              const sug = suggestLots(p, views, orders, profiles, etas);
              const fresh = newLotDate(p, views, today);
              const runningSame = views.some((v) => v.state === "RUNNING" && orders.some((x) => x.lotNo === v.lotNo && profiles.get(x.prodOrder)?.conductorSize === p.conductorSize));
              const waitNoLot = !p.conductorStarted && !runningSame;
              const jam = trafficJam(lines, p.leftKm || p.km);
              const myCodes = new Set(finishLines.filter((l) => l.prodOrder === o.prodOrder).map((l) => l.sfgCode));
              const inStock = stock.filter((s) => myCodes.has(s.itemCode));
              const cust = o.customerDate?.toISOString().slice(0, 10) ?? null;
              const tone = (fg: string | null) => (!fg || !cust ? "neutral" : fg <= cust ? "good" : (Date.parse(fg) - Date.parse(cust)) / 86_400_000 <= 5 ? "warning" : "critical");
              return (
                <article key={o.prodOrder} className="rounded-panel border border-line-2 p-4">
                  <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="num text-body font-semibold">{o.prodOrder}</h3>
                    <span className="text-label">{o.party}</span>
                    <span className="text-caption text-ink-2">{o.cable}</span>
                    <span className="num text-label">{p.km} km</span>
                    {o.addedAt && <Badge tone="critical">New · {dateTime(o.addedAt)}</Badge>}
                    {isMd && <ReadAloudButton prodOrder={o.prodOrder} />}
                    <span className="ml-auto text-caption text-ink-2">
                      Customer date: {isMd ? <CustomerDate prodOrder={o.prodOrder} value={cust} /> : d(cust)}
                    </span>
                  </header>

                  {p.km <= SMALL_KM && (
                    <p className="mt-3 rounded-control bg-warning-bg px-3 py-2 text-label font-medium text-warning">
                      Small order ({p.km} km): give from dead stock or buy from the market instead? (CR-F-36){p.anyDone && " – already started, so dead stock may not be used (CR-F-37)."}
                    </p>
                  )}

                  <p className="mt-3 text-label">
                    <span className="text-ink-2">Stock: </span>
                    {!stockCount ? (
                      <span className="text-ink-2">stock list not connected yet – check dead / old / free stock by hand.</span>
                    ) : inStock.length ? (
                      inStock.map((s) => `${s.qty} km in stock (batch ${s.batch ?? "–"}, ${s.godown ?? "–"}${s.isDead ? ", dead" : ""})`).join(" · ")
                    ) : (
                      "none of this item in stock."
                    )}
                  </p>

                  <p className="mt-1 text-caption text-ink-2">
                    {p.product} · {p.category} · {p.conductorSize ?? "?"} sq mm {p.conductorType ?? ""} · {p.insulation ?? "?"} · armour {p.armoured ? (p.armour ?? "not in BOM") : "none"} · {p.pending === "Conductor" && !p.conductorStarted ? "conductor not started" : `pending from ${p.pending}`}
                  </p>
                  {waitNoLot && <p className="mt-1 text-label text-warning">Waiting – no lot: conductor not started and no running lot makes {p.conductorSize ?? "this"} sq mm (CR-E-22).</p>}

                  {!sug.some((s) => s.fits) && <p className="mt-3 text-label font-medium">No running or coming lot fits this order: make a new lot{waitNoLot ? ", or keep it waiting" : ""}. The nearest lots are shown with what fails.</p>}
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {sug.map((s) => (
                      <section key={s.lotNo} className={`rounded-control border p-3 ${s.fits ? "border-good" : "border-line-2"}`}>
                        <div className="flex items-baseline gap-2">
                          <h4 className="font-semibold">Put in {s.lotNo}</h4>
                          <Badge tone={s.fits ? "good" : "critical"}>{s.fits ? "All checks pass" : `${failed(s.checks).length} check(s) fail`}</Badge>
                        </div>
                        <CheckTable checks={s.checks} />
                        <p className="mt-2 text-label">
                          FG ready ~<Badge tone={tone(s.fgReady)}>{d(s.fgReady)}</Badge>
                        </p>
                        {s.laterDelayDays > 0 && (
                          <details className="mt-1 text-caption">
                            <summary className="cursor-pointer text-ink-2">Later lots move ~{s.laterDelayDays} day(s)</summary>
                            <ul className="num mt-1 space-y-0.5">
                              {s.later.map((l) => (
                                <li key={l.lotNo}>
                                  {l.lotNo}: {d(l.was)} → {d(l.now)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {isMd && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {s.fits ? (
                              <ActionButton variant="primary" action={addToLot.bind(null, o.prodOrder, s.lotNo, false)}>
                                Put in {s.lotNo}
                              </ActionButton>
                            ) : (
                              <ActionButton action={addToLot.bind(null, o.prodOrder, s.lotNo, true)}>Urgent: put in {s.lotNo}</ActionButton>
                            )}
                          </div>
                        )}
                      </section>
                    ))}
                    <section className="rounded-control border border-dashed border-line p-3">
                      <h4 className="font-semibold">Make a new lot</h4>
                      <p className="mt-1 text-label">
                        FG ready ~<Badge tone={tone(fresh)}>{d(fresh)}</Badge>
                      </p>
                      <p className="mt-1 text-caption text-ink-2">Starts after the last lot in run order, as Draft until the MD approves it.</p>
                      {isMd && (
                        <div className="mt-3">
                          <ActionButton action={newLotFor.bind(null, o.prodOrder)}>Make new lot</ActionButton>
                        </div>
                      )}
                    </section>
                  </div>

                  <ul className="mt-3 space-y-0.5 text-caption">
                    {p.product !== "Cable" && <li className="text-ink-2">Traffic jam check: not on the cable line (laying, sheathing, armouring).</li>}
                    {p.product === "Cable" && jam.map((j) => (
                      <li key={j.stage} className={j.jam ? "text-critical" : "text-ink-2"}>
                        Traffic jam check – {j.text}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-caption text-ink-3">RM and drum shortage for a proposal show on the production and drum cards once the lot is planned.</p>

                  {isMd && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-2 pt-3">
                      <StockPicker prodOrder={o.prodOrder} />
                      <ActionButton action={holdOrder.bind(null, o.prodOrder, true)}>Hold</ActionButton>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>

        <Panel id="unapproved" title={`ERP approval pending (${unapproved.length})`} subtitle="Kharagpur orders in SFG not yet approved in ERP. Not for a lot until approved (CR-B-05)." glyph="clock">
          {unapproved.length ? (
            <ul className="space-y-1 text-label">
              {unapproved.map((u) => (
                <li key={u.prodOrder}>
                  <span className="num font-medium">{u.prodOrder}</span> · {u.party} · <span className="text-ink-2">{u.cable}</span> · {d(u.orderDate)}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>None (filled in at each sync once Club &amp; Run is kept in the dashboard).</Empty>
          )}
        </Panel>

        {held.length > 0 && (
          <Panel id="held" title={`Held (${held.length})`} subtitle="Orders the MD put on hold" glyph="list">
            <ul className="space-y-2 text-label">
              {held.map((o) => (
                <li key={o.prodOrder} className="flex flex-wrap items-center gap-3">
                  <span className="num font-medium">{o.prodOrder}</span> {o.party} <span className="text-ink-2">{o.cable}</span>
                  {isMd && <ActionButton action={holdOrder.bind(null, o.prodOrder, false)}>Release</ActionButton>}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel id="done" title={`Nothing left at Kharagpur, in no lot (${doneNoLot.length})`} subtitle="Shown to the MD. Removed only on the MD's word; the row stays in the change log." glyph="list">
          {doneNoLot.length ? (
            <ul className="space-y-2 text-label">
              {doneNoLot.map((o) => (
                <li key={o.prodOrder} className="flex flex-wrap items-center gap-3">
                  <span className="num font-medium">{o.prodOrder}</span> {o.party} <span className="text-ink-2">{o.cable}</span>
                  {isMd && <ActionButton action={removeOrder.bind(null, o.prodOrder)}>Remove</ActionButton>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>None.</Empty>
          )}
        </Panel>

        <Panel id="record" title="New-order record" subtitle="When each order came, what was proposed, what the MD chose and when, and the promised FG date against the actual one." glyph="list">
          {record.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-label">
                <thead className="text-caption text-ink-2">
                  <tr>
                    {["Order", "Came", "Proposed", "MD chose", "Decided", "Promised FG", "Actual FG", "Off by"].map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-line-2 px-2 py-1.5 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {record.map((o) => {
                    const mine = changes.filter((c) => c.key === o.prodOrder);
                    const decided = mine.filter((c) => c.field !== "added" && c.field !== "finished").at(-1);
                    const finished = mine.find((c) => c.field === "finished");
                    const promised = o.promisedOn?.toISOString().slice(0, 10) ?? null;
                    const actual = finished ? finished.at.toISOString().slice(0, 10) : null;
                    const off = promised && actual ? Math.round((Date.parse(actual) - Date.parse(promised)) / 86_400_000) : null;
                    return (
                      <tr key={o.prodOrder} className="border-b border-line-2">
                        <td className="num px-2 py-1.5">{o.prodOrder}</td>
                        <td className="num px-2">{o.addedAt ? dateTime(o.addedAt) : "from sheet"}</td>
                        <td className="px-2">{o.suggestedLot ?? "–"}</td>
                        <td className="px-2">{o.lotNo ?? (isStock(o) ? o.supplyFrom : o.onHold ? "Hold" : "–")}</td>
                        <td className="num px-2">{decided ? `${dateTime(decided.at)} · ${decided.by}` : "–"}</td>
                        <td className="num px-2">{d(promised)}</td>
                        <td className="num px-2">{d(actual)}</td>
                        <td className="num px-2">{off === null ? "–" : off > 0 ? `${off}d late` : `${-off}d early`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No new orders recorded yet.</Empty>
          )}
        </Panel>
      </main>
    </>
  );
}

function CheckTable({ checks }: { checks: Check[] }) {
  return (
    <table className="mt-2 w-full text-caption">
      <tbody>
        {checks.map((c) => (
          <tr key={c.code} className="border-b border-line-2 last:border-0">
            <td className="w-5 py-1 align-top" aria-label={c.ok ? "pass" : "fail"}>
              <span className={c.ok ? "text-good" : c.blocking ? "text-critical" : "text-warning"}>{c.ok ? "✓" : "✗"}</span>
            </td>
            <td className="py-1 pr-2 align-top">
              {c.label}
              {!c.blocking && <span className="text-ink-3"> (where possible)</span>}
            </td>
            <td className="num py-1 align-top text-ink-2">
              {c.order} / {c.lot}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


