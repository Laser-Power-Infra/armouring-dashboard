import { connection } from "next/server";
import { db } from "@/lib/db";
import { getDrums, versionLabel } from "@/lib/cards/data";
import { drumRequirementCard } from "@/lib/cards/drums";
import { Calendar, CardShell, Cols, How, pickIssue, Sec, Sheet, Swatch, Top } from "../_parts";

// Card 3, KGP Finished Goods Drum Requirement Card (build spec 8): what needs action, size-wise totals, then date by date.
export const instant = false;

export default async function DrumRequirementCardPage({ searchParams }: PageProps<"/cards/drum-requirement">) {
  await connection();
  const picked = await pickIssue(searchParams);
  if (!picked) return <CardShell active="/cards/drum-requirement" picked={null} />;
  const { issue } = picked;
  const { need, stock } = await getDrums(db, issue.id);
  const card = drumRequirementCard(need, stock, issue.d0);
  const f = card.facts;

  return (
    <CardShell active="/cards/drum-requirement" picked={picked} variant="drums">
      <Sheet>
        <Top
          version={versionLabel(issue)}
          group="Kharagpur plant"
          title="KGP Finished Goods Drum Requirement Card"
          facts={[
            ["Card period", f.period],
            ["Follows", `Machine Production Cards ${versionLabel(issue)}`],
            ["Cable drums", "Ready 4 days before the outer sheath date"],
            ["ACSR Raccoon drums", "On the machine the day before it runs"],
            ["Drums needed", <b key="v">{f.needed}</b>],
            ["In stock", <b key="v">{f.inStock}</b>],
            ["To be made", <span key="v"><b>{f.toMake}</b> (needs {f.flanges} flanges)</span>],
            ["How to make them", "See the Drum Assembly Card"],
          ]}
          right={
            <>
              <Calendar
                title="Drums to be ready, day by day"
                weeks={card.calendar}
                cell={(c) => ({ tone: c.tone, body: <>{c.n > 0 && <div className="cq">{c.n}</div>}<div className="cs">{c.text}</div></> })}
              />
              <div className="leg">
                <div>Big number = drums that must be ready on that date</div>
                <div><Swatch tone="work" />All from stock &nbsp;&nbsp;<Swatch tone="shortd" />Some drums to be made &nbsp;&nbsp;<Swatch tone="idle" />No drums needed &nbsp;&nbsp;<Swatch tone="out" />Outside this card</div>
                {card.lateLine && <div className="sec">{card.lateLine}</div>}
              </div>
            </>
          }
        />
        <How><b>How to read this card:</b> this page shows what needs action and the totals for each drum size. The next pages list, date by date, which drums must be ready. Drums in stock are used first. Words in <Sec>this colour</Sec> need attention.</How>
        {card.needsAction.length > 0 && (
          <>
            <h3>Needs action</h3>
            <table className="t">
              <Cols widths={[19, 53, 28]} />
              <thead>
                <tr><th>Drum size</th><th>Problem</th><th>What to do</th></tr>
              </thead>
              <tbody>
                {card.needsAction.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r.known ? r.size : <Sec>{r.size}</Sec>}</b></td>
                    <td className="sec">{r.problem}</td>
                    <td>{r.todo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div style={{ breakInside: "avoid" }}>
          <h3>Size by size: needed, in stock, to be made</h3>
          <table className="t">
            <Cols widths={[30, 14, 14, 14, 14, 14]} />
            <thead>
              <tr>
                <th>Drum size</th>
                <th className="num">Drums needed</th>
                <th className="num">In stock</th>
                <th className="num">To be made</th>
                <th className="num">Flanges needed</th>
                <th className="num">Flanges at Kharagpur</th>
              </tr>
            </thead>
            <tbody>
              {card.bySize.map((s) => (
                <tr key={s.size}>
                  <td><b>{s.known ? s.size : <Sec>{s.size}</Sec>}</b></td>
                  <td className="num">{s.needed}</td>
                  <td className="num">{s.inStock}</td>
                  <td className={s.toMake > 0 ? "num badc" : "num"}>{s.toMake}</td>
                  <td className="num">{s.flangesNeeded}</td>
                  <td className={s.flangesShort ? "num sec" : "num"}>{s.flangesKgp ?? "–"}</td>
                </tr>
              ))}
              <tr className="totr">
                <td><b>Total</b></td>
                <td className="num">{card.total.needed}</td>
                <td className="num">{card.total.inStock}</td>
                <td className="num">{card.total.toMake}</td>
                <td className="num">{card.total.flanges}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3>Date by date: which drums must be ready when</h3>
        <table className="t">
          <Cols widths={[10, 18, 7, 7, 7, 22, 12, 17]} />
          <thead>
            <tr>
              <th>Ready by</th>
              <th>Drum size</th>
              <th className="num">Drums needed</th>
              <th className="num">From stock</th>
              <th className="num">To be made</th>
              <th>For which order<div className="ths">order number and lot below</div></th>
              <th>Drum is used on</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r, i) => (
              <tr key={i} className={r.first ? "dstart" : undefined}>
                <td className="dt">{r.first && (r.late ? <Sec>Late – needed now</Sec> : r.readyBy)}</td>
                <td>{r.size.known ? r.size.text : <Sec>{r.size.text}</Sec>}</td>
                <td className="num">{r.needed}</td>
                <td className="num">{r.fromStock}</td>
                <td className={r.toMake > 0 ? "num sec" : "num"}>{r.toMake}</td>
                <td><div>{r.partyCable}</div><div className="sm">{r.orderLot}</div></td>
                <td>{r.usedOn}</td>
                <td>{r.remarkAttention ? <Sec>{r.remark}</Sec> : r.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
    </CardShell>
  );
}
