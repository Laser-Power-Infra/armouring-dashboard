import { connection } from "next/server";
import { db } from "@/lib/db";
import { getCardPlan, versionLabel } from "@/lib/cards/data";
import { MACHINE_ORDER, RUNS_WITH } from "@/lib/cards/machines";
import { productionCards, WIN, type MachineCard } from "@/lib/cards/production";
import { Calendar, CardShell, Cols, How, loadedText, pickIssue, Sec, Sheet, Swatch, Top } from "../_parts";

// Card 1, KGP Machine Production Cards (build spec 4): a cover page, then one page per machine.
export const instant = false;

const DOT = "●";

export default async function ProductionCardsPage({ searchParams }: PageProps<"/cards/production">) {
  await connection();
  const picked = await pickIssue(searchParams);
  if (!picked) return <CardShell active="/cards/production" picked={null} />;
  const { issue } = picked;
  const card = productionCards(await getCardPlan(db, issue.id));
  const version = versionLabel(issue);

  return (
    <CardShell active="/cards/production" picked={picked}>
      <Sheet>
        <Top
          version={version}
          group="Kharagpur plant"
          title="KGP Machine Production Cards"
          facts={[
            ["Card period", card.period],
            ["Data", `Sheet version “${issue.version}”, loaded ${loadedText(issue)}`],
            ["Machines", `${MACHINE_ORDER.length}, one card each, in process order`],
            ["Job lines checked", <b key="v">{card.cover.jobLines}</b>],
            ["Feed ready a day ahead or in stock", <b key="v">{card.cover.feedReady}</b>],
            ["Feed missing", card.cover.feedMissing ? <b key="v" className="sec">{card.cover.feedMissing}</b> : <b key="v">0</b>],
            ["Need drums from the yard", card.cover.needDrums ? <span key="v"><b className="sec">{card.cover.needDrums}</b> ACSR Raccoon lines on Skip 10</span> : <b key="v">0</b>],
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
        <h3>All machines at a glance</h3>
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
                <td className={m.load.attention ? "sec" : undefined}>{m.load.short}</td>
                <td className="num">{m.info.menPerShift || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
      {card.machines.map((m) => (
        <MachinePage key={m.name} m={m} version={version} period={card.period} />
      ))}
    </CardShell>
  );
}

function MachinePage({ m, version, period }: { m: MachineCard; version: string; period: string }) {
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
          ["Men needed", m.info.menPerShift ? `${m.info.menPerShift} in each shift · names are on the Labour Allocation Card` : "None in this period"],
          ["Card period", period],
          ["Planned in this period", m.units.length ? <span key="v"><b>{m.planned}</b> on <b>{days}</b> of {WIN} days</span> : <span key="v"><b>{days}</b> of {WIN} days</span>],
          ["Load", m.load.attention ? <span key="v"><Sec>{m.load.text}</Sec>{m.load.tail}</span> : m.load.text],
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
                <tr key={i} className={j.first ? "dstart" : undefined}>
                  <td className="dt">{j.first && j.date}</td>
                  <td><div>{j.order}</div><div className="sm">{j.mc}</div></td>
                  <td>
                    <div>{j.partyCable}</div>
                    <div className="sm">
                      {j.job}
                      {j.jobAttention && <> – <Sec>{j.jobAttention}</Sec></>}
                      {j.ext51 && <> · <Sec>Extruder 51 could take this – plant to decide</Sec></>}
                    </div>
                  </td>
                  <td>{j.core}</td>
                  <td>{j.lot}</td>
                  <td className="num">{j.qty}</td>
                  <td>{j.material}</td>
                  <td>
                    {j.status === "wait" ? <Sec>{j.feed}</Sec> : j.feed}
                    {j.drums && <div className="sec">{j.drums}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {follows && days > 0 && <How>This machine has no order-wise job list. It runs on the {days} green days to supply wire to the machines named above.</How>}
    </Sheet>
  );
}
