import type { drumChanges } from "@/lib/cards/drums";
import { Cols, How, Sec, Sheet, Top } from "./_parts";

/** "vs Rev n-1" cell: same / new / was n; anything but "same" needs attention. */
export function VsCell({ text }: { text: string }) {
  return <td className={text === "same" ? undefined : "sec"}>{text}</td>;
}

/** Rule 32: the first page of a drum card – what changed from the issue it replaces, and why. */
export function DrumChangesPage({ changes, version, card }: { changes: NonNullable<ReturnType<typeof drumChanges>>; version: string; card: string }) {
  return (
    <Sheet>
      <Top
        version={version}
        group={card}
        title={`What changed from ${changes.prevName} – and why`}
        facts={[
          ["Revision", <b key="v">{changes.name} replaces {changes.prevName}</b>],
          ["Why", changes.note ? changes.note : <Sec key="v">No reason written for this revision</Sec>],
          ["Drums to assemble up to " + changes.upTo, <span key="v"><b>{changes.toMake}</b> (was {changes.prevToMake} in {changes.prevName})</span>],
        ]}
        right={null}
      />
      <How>Each order whose drums changed, or that is new or gone. The tables on the next pages also say, row by row, how each row compares with {changes.prevName}.</How>
      <table className="t">
        <Cols widths={[36, 24, 20, 20]} />
        <thead>
          <tr><th>Order</th><th>Drum size</th><th>{changes.prevName} – to assemble</th><th>{changes.name} – to assemble</th></tr>
        </thead>
        <tbody>
          {changes.rows.map((r) => (
            <tr key={r.order}>
              <td>{r.order}</td>
              <td>{r.known ? r.size : <Sec>{r.size}</Sec>}</td>
              <td>{r.prev}</td>
              <td className={r.prev !== r.now ? "sec" : undefined}>{r.now}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
