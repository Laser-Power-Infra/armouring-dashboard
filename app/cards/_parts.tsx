import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ddMonYy } from "@/lib/cards/calendar";
import type { CalCell } from "@/lib/cards/calendar";
import { getIssues, issueName, type Issue } from "@/lib/cards/data";
import { MainNav } from "@/components/dash/main-nav";
import { IssuePicker, PrintButton } from "./_controls";

export const CARD_TABS = [
  { href: "/cards/production", label: "Production" },
  { href: "/cards/labour", label: "Labour" },
  { href: "/cards/drum-requirement", label: "Drum requirement" },
  { href: "/cards/drum-assembly", label: "Drum assembly" },
] as const;

type Search = Promise<Record<string, string | string[] | undefined>>;

/** The issue to show: the one asked for in ?issue=, else the newest. Null when nothing has been stored yet. */
export async function pickIssue(searchParams: Search): Promise<{ issue: Issue; issues: Issue[] } | null> {
  const asked = (await searchParams).issue;
  const issues = await getIssues(db);
  if (!issues.length) return null;
  if (asked === undefined) return { issue: issues[0], issues };
  const issue = issues.find((i) => String(i.id) === asked);
  if (!issue) notFound();
  return { issue, issues };
}

/** When the sheet's data was stored, in plant time. */
export const loadedText = (issue: Issue) =>
  `${ddMonYy(new Date(issue.loadedAt.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10))} ${new Date(issue.loadedAt.getTime() + 5.5 * 3_600_000).toISOString().slice(11, 16)} IST`;

/** The app bar with the four card tabs, then the card itself. `variant` picks the card's calendar sizes. */
export function CardShell({ active, picked, variant = "", children }: { active: (typeof CARD_TABS)[number]["href"]; picked: { issue: Issue; issues: Issue[] } | null; variant?: "" | "labour" | "drums"; children?: ReactNode }) {
  const query = picked && picked.issue.id !== picked.issues[0].id ? `?issue=${picked.issue.id}` : "";
  return (
    <>
      <header className="no-print sticky top-0 z-20 border-b border-line-2 bg-surface">
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
          <span className="hidden text-body font-semibold sm:inline">Kharagpur</span>
          <MainNav active={active} query={query} />
          <div className="ml-auto flex items-center gap-2">
            {picked && <IssuePicker current={picked.issue.id} issues={picked.issues.map((i) => ({ id: i.id, name: issueName(i) }))} />}
            {picked && <PrintButton />}
          </div>
        </div>
      </header>
      <main className="kgp-stage flex-1">
        {picked ? (
          <div className={`kgp-card ${variant}`}>{children}</div>
        ) : (
          <div className="mx-auto mt-16 max-w-md rounded-panel border border-line bg-surface p-6 text-center">
            <h1 className="text-title font-semibold">No cards have been issued yet</h1>
            <p className="mt-2 text-label text-ink-2">Cards appear here after the card data sheet is loaded.</p>
          </div>
        )}
      </main>
    </>
  );
}

/** One printed page. */
export const Sheet = ({ children }: { children: ReactNode }) => <section className="kgp-sheet">{children}</section>;

/** Words that need attention (orange). */
export const Sec = ({ children }: { children: ReactNode }) => <span className="sec">{children}</span>;

export function Facts({ rows }: { rows: (readonly [string, ReactNode] | null | false | undefined)[] }) {
  return (
    <table className="facts">
      <tbody>
        {rows.map(
          (r) =>
            r && (
              <tr key={r[0]}>
                <td className="fl">{r[0]}</td>
                <td>{r[1]}</td>
              </tr>
            ),
        )}
      </tbody>
    </table>
  );
}

/** The header of every card page: version box, group line, title and facts on the left; `right` beside them. */
export function Top({ version, group, title, facts, right }: { version: string; group: string; title: string; facts: Parameters<typeof Facts>[0]["rows"]; right: ReactNode }) {
  return (
    <div className="top">
      <div className="left">
        <div className="ver">{version}</div>
        <div className="grp">{group}</div>
        <h1>{title}</h1>
        <Facts rows={facts} />
      </div>
      <div className="right">{right}</div>
    </div>
  );
}

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-to-Sunday calendar. `cell` gives each day inside the card its colour and content; days outside are grey. */
export function Calendar<T extends CalCell>({ title, weeks, cell }: { title: string; weeks: T[][]; cell: (c: T) => { tone: string; mark?: ReactNode; body?: ReactNode } }) {
  return (
    <>
      <div className="caltitle">{title}</div>
      <table className="cal">
        <thead>
          <tr>
            {WEEK.map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].day}>
              {week.map((c) => {
                const { tone, mark, body } = c.index === null ? { tone: "out" } : cell(c);
                return (
                  <td key={c.day} className={tone}>
                    <div className="cd">
                      {c.label}
                      {mark}
                    </div>
                    {body}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export const Swatch = ({ tone, children }: { tone: string; children?: ReactNode }) => <span className={`sw ${tone}`}>{children}</span>;

export const How = ({ children }: { children: ReactNode }) => <div className="how">{children}</div>;

/** Column widths of a card table, in percent, as on the approved card. */
export const Cols = ({ widths }: { widths: number[] }) => (
  <colgroup>
    {widths.map((w, i) => (
      <col key={i} style={{ width: `${w}%` }} />
    ))}
  </colgroup>
);
