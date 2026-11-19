import { connection } from "next/server";
import { db } from "@/lib/db";
import { getLabour, versionLabel } from "@/lib/cards/data";
import { labourCard, type ShiftCell } from "@/lib/cards/labour";
import { Calendar, CardShell, Cols, How, pickIssue, Sec, Sheet, Swatch, Top } from "../_parts";

// Card 2, KGP Labour Allocation Card (build spec 6): what needs action, then one page per date.
export const instant = false;

export default async function LabourCardPage({ searchParams }: PageProps<"/cards/labour">) {
  await connection();
  const picked = await pickIssue(searchParams);
  if (!picked) return <CardShell active="/cards/labour" picked={null} />;
  const { issue } = picked;
  const { labour, spare } = await getLabour(db, issue.id);
  const card = labourCard(labour, spare, issue.d0);
  const f = card.facts;

  return (
    <CardShell active="/cards/labour" picked={picked} variant="labour">
      <Sheet>
        <Top
          version={versionLabel(issue)}
          group="Kharagpur plant"
          title="KGP Labour Allocation Card"
          facts={[
            ["Card period", f.period],
            ["Follows", `Machine Production Cards ${versionLabel(issue)}`],
            ["Shifts and weekly offs", "Taken from the roster, not changed here"],
            ["Machine-shifts to fill", <b key="v">{f.toFill}</b>],
            ["With an operator", <span key="v"><b>{f.withOperator}</b> of {f.toFill}</span>],
            ["With the full team", <span key="v"><b>{f.fullTeam}</b> of {f.toFill}</span>],
            ["Lines needing action", f.needingAction ? <span key="v"><b>{f.needingAction}</b> – see the table below</span> : <b key="v">0</b>],
          ]}
          right={
            <>
              <Calendar
                title="Men named, day by day"
                weeks={card.calendar}
                cell={(c) => ({ tone: c.ok ? "work" : "shortd", body: <div className="cq">{c.got}<span className="of"> of {c.need}</span></div> })}
              />
              <div className="leg">
                <div>Numbers = men named <b>of</b> men needed that day (day + night shift)</div>
                <div><Swatch tone="work" />All men named &nbsp;&nbsp;&nbsp;<Swatch tone="shortd" />Short of men or no operator on some shift</div>
                <div><Swatch tone="out" />Day outside this card</div>
              </div>
            </>
          }
        />
        <How><b>How to read this card:</b> this page shows only what needs action. After it there is one page for each date, showing who is on which machine. Words in <Sec>this colour</Sec> need attention.</How>
        <h3>Needs action</h3>
        {card.needsAction.length ? (
          <table className="t">
            <Cols widths={[9, 7, 14, 45, 25]} />
            <thead>
              <tr><th>Date</th><th>Shift</th><th>Machine</th><th>Problem</th><th>What to do</th></tr>
            </thead>
            <tbody>
              {card.needsAction.map((r, i) => (
                <tr key={i}>
                  <td className="dt">{r.date}</td>
                  <td>{r.shift}</td>
                  <td><b>{r.machine}</b></td>
                  <td className="sec">{r.problem}</td>
                  <td>{r.todo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <How>Nothing needs action: every machine-shift has its operator and full team.</How>
        )}
      </Sheet>
      {card.days.map((d) => (
        <Sheet key={d.day}>
          <div className="grp">KGP Labour Allocation Card – who is on which machine</div>
          <h2>{d.title}</h2>
          {d.machines.length > 0 && (
            <table className="t">
              <Cols widths={[10, 5, 14, 26, 5, 14, 26]} />
              <thead>
                <tr>
                  <th rowSpan={2}>Machine</th>
                  <th colSpan={3} className="g">Day shift</th>
                  <th colSpan={3} className="g">Night shift</th>
                </tr>
                <tr><th>Men</th><th>Operator</th><th>Helpers</th><th>Men</th><th>Operator</th><th>Helpers</th></tr>
              </thead>
              <tbody>
                {d.machines.map((m) => (
                  <tr key={m.name}>
                    <td><b>{m.name}</b></td>
                    <Shift s={m.day} />
                    <Shift s={m.night} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.noJob && <How><b>No job on the production card today:</b> {d.noJob}. The labour of these machines can be utilized for some other purposes.</How>}
          {d.spare.length > 0 && (
            <>
              <h3>Men without a machine today – can be utilized for some other purposes</h3>
              <table className="t">
                <Cols widths={[10, 6, 30, 54]} />
                <thead>
                  <tr><th>Shift</th><th>Men</th><th>Operators</th><th>Helpers</th></tr>
                </thead>
                <tbody>
                  {d.spare.map((s) => (
                    <tr key={s.shift}>
                      <td><b>{s.shift}</b></td>
                      <td className="c">{s.count}</td>
                      <td>{s.operators}</td>
                      <td>{s.helpers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Sheet>
      ))}
    </CardShell>
  );
}

function Shift({ s }: { s: ShiftCell }) {
  if (!s) return <td colSpan={3} className="nr">not running in this shift</td>;
  return (
    <>
      <td className={s.bad ? "c badc" : "c"}>{s.men}</td>
      <td>
        {s.operator ? <b>{s.operator}</b> : <Sec>No experienced operator – plant to name</Sec>}
        {s.usual && <div className="sm">his usual machine: {s.usual}</div>}
        {s.confirm && <div className="sec">to confirm – {s.confirm}</div>}
      </td>
      <td>{s.helpers}</td>
    </>
  );
}
