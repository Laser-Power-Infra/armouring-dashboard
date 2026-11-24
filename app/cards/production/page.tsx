import { cachedCard1Sources, cachedCardPlan, cachedDrums } from "@/lib/cached";
import { connection } from "next/server";
import { issueName, versionLabel } from "@/lib/cards/data";
import { heldUp } from "@/lib/cards/drums";
import { MACHINE_ORDER, RUNS_WITH } from "@/lib/cards/machines";
import { productionCards, WIN, type MachineCard, type Materials } from "@/lib/cards/production";
import { ActionHead, Calendar, CardShell, Cols, How, loadedText, pickIssue, Sec, Sheet, Swatch, Top } from "../_parts";

// Card 1, KGP Machine Production Cards (docs/final guide for card 1.md, section 5):
// a cover page, the raw material issue plan, then one page per machine.
export const instant = false;

const DOT = "●";
const kg = (n: number) => (n > 0 ? n.toLocaleString("en-US") : "");
const TO_CONFIRM = <Sec>⚠ to confirm</Sec>;

/** Dates down, materials across, with a Total row. */
function MaterialsByDate({ rm }: { rm: Materials }) {
  return (
    <table className="t">
      <thead>
        <tr>
          <th>Date</th>
          {rm.names.map((n) => (
            <th key={n} className="num">{n} (kg)</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rm.days.map((d) => (
          <tr key={d.date}>
            <td className="dt">{d.date}</td>
            {d.kg.map((k, i) => (
              <td key={i} className="num">{kg(k)}</td>
            ))}
          </tr>
        ))}
        <tr className="dstart">
          <td><b>Total</b></td>
          {rm.total.map((k, i) => (
            <td key={i} className="num"><b>{kg(k)}</b></td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export default async function ProductionCardsPage({ searchParams }: PageProps<"/cards/production">) {
  await connection();
  const picked = await pickIssue(searchParams);
  if (!picked) return <CardShell active="/cards/production" picked={null} />;
  const { issue } = picked;
  const [plan, src, drums] = await Promise.all([cachedCardPlan(issue.id), cachedCard1Sources(), cachedDrums(issue.id)]);
  // Rule 11: ACSR drums the assembly card holds up (no flanges, BUY) – the Skip 10 line waits for them.
  const waiting = new Map<string, number>();
  for (const r of heldUp(drums.assembly, drums.stock)) if (r.held) waiting.set(`${r.prodOrder}|${r.usedOn}`, (waiting.get(`${r.prodOrder}|${r.usedOn}`) ?? 0) + r.drums);
  const card = productionCards(plan, waiting, src.drums);
  const men = (name: string) => src.men.get(name) ?? null;
  const version = versionLabel(issue);
  const prev = picked.issues.find((i) => i.id === issue.prevIssueId);
  // Raw material the plan needs beyond the planning stock (also shown in the issue plan).
  const short = card.rm.names.filter((n, i) => {
    const stock = src.stock.get(n);
    return stock !== undefined && card.rm.total[i] > stock;
  });

  return (
    <CardShell active="/cards/production" picked={picked}>
      <Sheet>
        <Top
          version={version}
          group="Kharagpur plant"
          title="KGP Machine Production Cards"
          facts={[
            ["Card period", card.period],
            ["Data", issue.s8PulledAt ? `Balances: SFG dashboard ${issue.s8PulledAt}; lots: Club & Run (${src.approvedLots} approved lots)` : `Sheet version “${issue.version}”, loaded ${loadedText(issue)}`],
            !!prev && (["Revision", <span key="v"><b>{issueName(issue)} replaces {issueName(prev)}</b>{issue.issueNote ? ` – ${issue.issueNote}` : ""}</span>] as const),
            ["Machines", `${MACHINE_ORDER.length}, one card each, in process order`],
            ["Bottleneck", <b key="v" className="load-bottleneck">{card.bottleneck}</b>],
            ["Finish date (bottleneck's last planned day)", <b key="v">{card.finish}</b>],
            ["Job lines checked", <b key="v">{card.cover.jobLines}</b>],
            ["Feed ready a day ahead or in stock", <b key="v">{card.cover.feedReady}</b>],
            ["Same day – no margin", card.cover.sameDay ? <b key="v" className="sec">{card.cover.sameDay}</b> : <b key="v">0</b>],
            ["Feed missing", card.cover.feedMissing ? <b key="v" className="sec">{card.cover.feedMissing}</b> : <b key="v">0</b>],
            ["Raw material short", short.length ? <span key="v" className="sec">{short.join(" · ")}</span> : <b key="v">None</b>],
            ["Need drums from the yard", card.cover.needDrums ? <span key="v"><b className="sec">{card.cover.needDrums}</b> ACSR Raccoon lines on Skip 10{card.cover.waitingDrums ? <>, of which <b className="sec">{card.cover.waitingDrums}</b> waiting for drums</> : ""}</span> : <b key="v">0</b>],
            [
              "Not planned – to confirm",
              issue.notPlanned.length ? (
                <span key="v" className="sec">
                  <b>{issue.notPlanned.length}</b>
                  {issue.notPlanned.map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </span>
              ) : (
                <b key="v">0</b>
              ),
            ],
            ["Men on each machine", "See the Labour Allocation Card"],
          ]}
          right={
            <>
              <div className="caltitle">Colours used on every card</div>
              <div className="leg" style={{ fontSize: "8.5pt", lineHeight: 2 }}>
                <div><Swatch tone="work" />Working day</div>
                <div><Swatch tone="idle" />Off day (no work)</div>
                <div><Swatch tone="out" />Day outside this card</div>
                <div><Sec>Words in this colour</Sec> need attention</div>
              </div>
            </>
          }
        />
        <ActionHead title="All machines at a glance" cardFor="Devika, Mukesh, Kamlesh" />
        <table className="t">
          <Cols widths={[18, 16, 14, 24, 16, 12]} />
          <thead>
            <tr>
              <th>Machine</th>
              <th>Group</th>
              <th className="num">Working days</th>
              <th className="num">Planned in this period</th>
              <th>Load</th>
              <th className="num">Men per shift</th>
            </tr>
          </thead>
          <tbody>
            {card.machines.map((m) => (
              <tr key={m.name}>
                <td><b>{m.name}</b></td>
                <td>{m.info.group}</td>
                <td className="num">{m.workingDays.size} of {WIN}</td>
                <td className="num">{m.planned}</td>
                <td className={m.load.tone === "normal" ? undefined : `load-${m.load.tone}`}>{m.load.short}</td>
                <td className="num">{men(m.name) ?? TO_CONFIRM}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
      <Sheet>
        <Top
          version={version}
          group="KGP Machine Production Cards"
          title="Raw material issue plan"
          facts={[
            ["Card period", card.period],
            ["Quantity", "Planned km × ERP BOM kg per km; issue on the morning of the date"],
            ["Stock check", <span key="v">Stock = “Qty used for planning” of the RM opening stock sheet. <Sec>Words in this colour</Sec> = the plan needs more than the stock</span>],
          ]}
          right={null}
        />
        {/* Materials run down, not across: the plan uses about 30 of them and the page is 15 dates wide. */}
        <h3>Material to issue, date by date (kg, all machines)</h3>
        <table className="t">
          <Cols widths={[20, ...card.rm.days.map(() => 64 / card.rm.days.length), 8, 8]} />
          <thead>
            <tr>
              <th>Material</th>
              {card.rm.days.map((d) => (
                <th key={d.date} className="num">{d.date}</th>
              ))}
              <th className="num">Total</th>
              <th className="num">Stock</th>
            </tr>
          </thead>
          <tbody>
            {card.rm.names.map((name, i) => {
              const stock = src.stock.get(name);
              const short = stock !== undefined && card.rm.total[i] > stock;
              return (
                <tr key={name}>
                  <td>{name}</td>
                  {card.rm.days.map((d) => (
                    <td key={d.date} className="num">{kg(d.kg[i])}</td>
                  ))}
                  <td className={short ? "num sec" : "num"}><b>{kg(card.rm.total[i])}</b></td>
                  <td className={short ? "num sec" : "num"}>{stock === undefined ? TO_CONFIRM : stock.toLocaleString("en-US")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3>Which machine takes each material</h3>
        <table className="t">
          <Cols widths={[24, 64, 12]} />
          <thead>
            <tr>
              <th>Material</th>
              <th>Machine (kg)</th>
              <th className="num">Total (kg)</th>
            </tr>
          </thead>
          <tbody>
            {card.rm.names.map((name, i) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{card.takers(name)}</td>
                <td className="num">{kg(card.rm.total[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
      {card.machines.map((m) => (
        <MachinePage key={m.name} m={m} version={version} period={card.period} men={men(m.name)} />
      ))}
    </CardShell>
  );
}

function MachinePage({ m, version, period, men }: { m: MachineCard; version: string; period: string; men: number | null }) {
  const days = m.workingDays.size;
  const follows = !!RUNS_WITH[m.name];
  return (
    <Sheet>
      <Top
        version={version}
        group="KGP Machine Production Card"
        title={m.name}
        facts={[
          ["Machine group", m.info.group],
          ["Makes", m.info.makes],
          ["Runs", m.info.runs],
          !!m.info.speed && (["Daily speed / limit", m.info.speed] as const),
          !!m.info.feedFrom && (["Feed comes from", m.info.feedFrom] as const),
          ["Men needed", men === null ? TO_CONFIRM : `${men} in each shift · names are on the Labour Allocation Card`],
          ["Card period", period],
          ["Planned in this period", m.units.length ? <span key="v"><b>{m.planned}</b> on <b>{days}</b> of {WIN} days</span> : <span key="v"><b>{days}</b> of {WIN} days</span>],
          ["Load", m.load.tone === "normal" ? m.load.text : <span key="v"><span className={`load-${m.load.tone}`}>{m.load.text}</span>{m.load.tail}</span>],
          !!m.info.note && (["Note", m.info.note] as const),
        ]}
        right={
          <>
            <Calendar
              title="Work days in this card"
              weeks={m.calendar}
              cell={(c) => ({
                tone: c.tone,
                mark: c.dot && <span className="chg">{DOT}</span>,
                body: c.tone === "work" ? <div className="cq">{c.big}</div> : <div className="cq0">{c.small}</div>,
              })}
            />
            <div className="leg">
              <div><Swatch tone="work" />{m.units.length ? `Working day. Big number = ${m.units.join(" / ")} planned that day` : "Working day"}</div>
              {m.hasDot && <div><Swatch tone="work dot">{DOT}</Swatch>White dot = size or material changes that day</div>}
              <div><Swatch tone="idle" />Off day (no work) &nbsp;&nbsp;&nbsp;<Swatch tone="out" />Day outside this card</div>
            </div>
          </>
        }
      />
      {m.jobs.length > 0 && (
        <>
          <How><b>How to read the table:</b> one line = one job for one day. A date with several lines means several jobs that day, in the order shown. Words in <Sec>this colour</Sec> need attention.</How>
          {m.jobs.some((j) => j.ask51) && (
            <How>
              <b>Small cable (up to 4C × 25) – lines in yellow. May these jobs go to Extruder 51? Tick and sign.</b> ☐ Yes &nbsp; ☐ No &nbsp;&nbsp; Signed: ____________ &nbsp; Date: ________
            </How>
          )}
          <h3>Jobs, day by day</h3>
          <table className="t">
            <Cols widths={[6, 10, 19, 9, 6, 9, 17, 24]} />
            <thead>
              <tr>
                <th>Date</th>
                <th>Production order<div className="ths">customer order below</div></th>
                <th>Customer · cable<div className="ths">job detail below</div></th>
                <th>Core</th>
                <th>Lot</th>
                <th className="num">Planned qty</th>
                <th>Material to be used</th>
                <th>Feed – where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {m.jobs.map((j, i) => (
                <tr key={i} className={[j.first && "dstart", j.ask51 && "ask51"].filter(Boolean).join(" ") || undefined}>
                  <td className="dt">{j.first && j.date}</td>
                  <td><div>{j.order}</div><div className="sm">{j.mc}</div></td>
                  <td>
                    <div>{j.partyCable}</div>
                    <div className="sm">
                      {j.job}
                      {j.jobAttention && <> – <Sec>{j.jobAttention}</Sec></>}
                    </div>
                  </td>
                  <td>{j.core}</td>
                  <td>{j.lot}</td>
                  <td className="num">{j.qty}</td>
                  <td>{j.material}</td>
                  <td>
                    {j.feed}
                    {j.drums && <div className="sec">{j.drums}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {follows && <How>This machine has no order-wise job list. It runs on the {days} green days to supply wire to the machines named above.</How>}
      {m.rm.names.length > 0 && (
        <>
          <h3>Raw material to issue to this machine, date by date</h3>
          <MaterialsByDate rm={m.rm} />
        </>
      )}
    </Sheet>
  );
}
