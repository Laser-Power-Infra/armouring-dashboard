import { cachedDrums } from "@/lib/cached";
import { connection } from "next/server";
import { versionLabel } from "@/lib/cards/data";
import { drumChanges, drumAssemblyCard, versus } from "@/lib/cards/drums";
import { ActionHead, Calendar, CardShell, Cols, How, loadedText, pickIssue, Sec, Sheet, Swatch, Top } from "../_parts";
import { DrumChangesPage, VsCell } from "../_drum-changes";

// Card 4, KGP Drum Assembly Card (build spec 9): what cannot be made yet, then which drums to make day by day.
export const instant = false;

export default async function DrumAssemblyCardPage({ searchParams }: PageProps<"/cards/drum-assembly">) {
  await connection();
  const picked = await pickIssue(searchParams);
  if (!picked) return <CardShell active="/cards/drum-assembly" picked={null} />;
  const { issue } = picked;
  const { need, assembly, stock } = await cachedDrums(issue.id);
  // Nothing to show: the drum sheets could not be read when this version was built.
  if (!need.length)
    return (
      <CardShell active="/cards/drum-assembly" picked={picked} variant="drums">
        <Sheet>
          <Top version={versionLabel(issue)} group="Kharagpur plant" title="KGP Drum Assembly Card" facts={[]} right={null} />
          <How><b>KGP Drum Assembly Card not built:</b> <span style={{ whiteSpace: "pre-line" }}>{issue.drumProblem ?? "No drum data was stored for this version"}</span></How>
        </Sheet>
      </CardShell>
    );
  const prev = picked.issues.find((i) => i.id === issue.prevIssueId);
  const prevDrums = prev ? await cachedDrums(prev.id) : null;
  const changes = prev && prevDrums && drumChanges(issue, prev, need, prevDrums.need);
  const card = drumAssemblyCard(assembly, stock, issue.d0, need);
  const f = card.facts;
  // Rule 32: drums to make per order and use date in the issue this one replaces.
  const prevMake = prevDrums && new Map(drumAssemblyCard(prevDrums.assembly, prevDrums.stock, prev!.d0, prevDrums.need).rows.map((r) => [r.key, r.drums]));

  return (
    <CardShell active="/cards/drum-assembly" picked={picked} variant="drums">
      {changes && <DrumChangesPage changes={changes} version={versionLabel(issue)} card="KGP Drum Assembly Card" />}
      <Sheet>
        <Top
          version={versionLabel(issue)}
          group="Kharagpur plant"
          title="KGP Drum Assembly Card"
          facts={[
            ["Card period", f.period],
            ["Follows", "Finished Goods Drum Requirement Card, same version"],
            ["For", "The drum assembly team"],
            ["Drums to be made", <span key="v"><b>{f.toMake}</b> (needs {f.flanges} flanges)</span>],
            ["Can be made now", <b key="v">{f.canMake}</b>],
            ["Held up", f.heldUp ? <span key="v"><b className="sec">{f.heldUp}</b> – see the table below</span> : <b key="v">0</b>],
            ["Already late", f.late ? <span key="v"><b className="sec">{f.late}</b> – make these first, listed under {f.d0}</span> : <b key="v">0</b>],
            ["Not listed here", "Drums already in stock"],
            ["Stock", `Drum Stock sheet (complete drums, Kharagpur and Poly Park flanges), read ${loadedText(issue)}`],
            ["Flanges", <span key="v">2 per drum: Kharagpur first, then Poly Park, then <b className="sec">BUY</b></span>],
            ["Every day", "Write the number made in the “Done” column"],
          ]}
          right={
            <>
              <Calendar
                title="Drums to be made, day by day"
                weeks={card.calendar}
                cell={(c) => ({ tone: c.tone, body: <>{c.n > 0 && <div className="cq">{c.n}</div>}<div className="cs">{c.text}</div></> })}
              />
              <div className="leg">
                <div>Big number = drums to be made by that date</div>
                <div><Swatch tone="work" />All can be made &nbsp;&nbsp;<Swatch tone="shortd" />Some held up (no flanges)</div>
                <div><Swatch tone="idle" />Nothing to make &nbsp;&nbsp;<Swatch tone="out" />Outside this card</div>
              </div>
            </>
          }
        />
        <How><b>How to read this card:</b> this page shows the totals and what is held up. The next pages list, day by day, which drums to make. “Make by” is the date the drum must be ready. Words in <Sec>this colour</Sec> need attention.</How>
        {card.cannot.length > 0 && (
          <>
            <ActionHead title="Cannot be made yet" cardFor="Srikant Rao" />
            <table className="t">
              <Cols widths={[22, 10, 34, 34]} />
              <thead>
                <tr><th>Drum size</th><th className="num">Drums</th><th>Problem</th><th>What to do</th></tr>
              </thead>
              <tbody>
                {card.cannot.map((r) => (
                  <tr key={r.code}>
                    <td><b>{r.known ? r.size : <Sec>{r.size}</Sec>}</b></td>
                    <td className="num">{r.drums}</td>
                    <td className="sec">{r.problem}</td>
                    <td className={r.buy > 0 ? "sec" : undefined}>{r.todo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <h3 className="pb">Day by day: which drums to make</h3>
        <table className="t">
          <Cols widths={prevMake ? [9, 17, 7, 7, 15, 18, 13, 7, 7] : [9, 19, 7, 7, 16, 20, 14, 8]} />
          <thead>
            <tr>
              <th>Make by</th>
              <th>Drum size</th>
              <th className="num">Drums to make</th>
              <th className="num">Flanges needed</th>
              <th>Flanges from</th>
              <th>For which order<div className="ths">order number and lot below</div></th>
              <th>Drum is used on</th>
              {prevMake && <th>vs {changes!.prevName}</th>}
              <th>Done<div className="ths">write number made</div></th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r, i) => (
              <tr key={i} className={r.first ? "dstart" : undefined}>
                <td className="dt">{r.first && <>{r.makeBy}<div className="sm">{r.dayTotal}</div></>}</td>
                <td>
                  {r.size.known ? r.size.text : <Sec>{r.size.text}</Sec>}
                  {r.late && <div className="sec">Late – make first</div>}
                </td>
                <td className="num">{r.drums}</td>
                <td className="num">{r.flanges}</td>
                <td>{r.held ? <Sec>{r.flangesFrom}</Sec> : r.flangesFrom}</td>
                <td><div>{r.partyCable}</div><div className="sm">{r.orderLot}</div></td>
                <td>{r.usedOn}</td>
                {prevMake && <VsCell text={versus(prevMake, r.key, r.drums)!} />}
                <td></td>
              </tr>
            ))}
            <tr className="totr">
              <td>Total</td>
              <td></td>
              <td className="num">{card.total.drums}</td>
              <td className="num">{card.total.flanges}</td>
              <td colSpan={prevMake ? 5 : 4}></td>
            </tr>
          </tbody>
        </table>
      </Sheet>
    </CardShell>
  );
}
