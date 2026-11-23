import { connection } from "next/server";
import { Badge } from "@/components/ui/panel";
import { db } from "@/lib/db";
import { ClubRunHeader } from "../_header";

// The MD's Club & Run rules (md_rules) as a rulebook: current rules only, grouped by section, full text.
export const metadata = { title: "Club & Run rules" };
export const instant = false;

/** What happens when a rule is not met, in plain words (the ruleset's on_fail values). */
const OUTCOME: Record<string, { label: string; tone: "critical" | "warning" | "neutral" }> = {
  block: { label: "Lot blocked", tone: "critical" },
  deny_write: { label: "Change refused", tone: "critical" },
  ask_md: { label: "Held for MD", tone: "warning" },
  flag: { label: "Allowed, flagged", tone: "warning" },
  skip: { label: "Order left out", tone: "neutral" },
};

type Details = { section?: string; on_fail?: string | null; message_on_fail?: string | null; override_by?: string | null };

export default async function ClubRunRulesPage() {
  await connection();
  const rules = await db.mdRules.findMany({ where: { newRuleId: null, deletedAt: null }, orderBy: [{ code: "asc" }, { id: "asc" }] });
  // Sections in rule-code order (CR-A, CR-B, ...), as the MD's sheet lists them.
  const sections = Map.groupBy(rules, (r) => (r.details as Details | null)?.section ?? "Other");
  const anchor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <>
      <ClubRunHeader active="/club-run/rules" />
      <main className="w-full flex-1 px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-10">
          <div>
            <h1 className="text-title">Club &amp; Run rules</h1>
            <p className="mt-1 text-label text-ink-2">
              {rules.length} rules given by the MD. Each card says what the rule is and what happens when it is not met.
            </p>
            <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
              {[...sections].map(([s, list]) => (
                <a key={s} href={`#${anchor(s)}`} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line-2 px-2.5 text-label text-ink-2 hover:bg-ground hover:text-ink">
                  {s} <span className="num text-ink-3">{list.length}</span>
                </a>
              ))}
            </nav>
          </div>

          {[...sections].map(([s, list]) => (
            <section key={s} id={anchor(s)} aria-labelledby={`${anchor(s)}-title`} className="scroll-mt-32">
              <h2 id={`${anchor(s)}-title`} className="mb-4 text-body font-semibold">
                {s}
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {list.map((r) => {
                  const d = (r.details ?? {}) as Details;
                  const out = d.on_fail ? OUTCOME[d.on_fail] : undefined;
                  return (
                    <article key={r.id} className="flex flex-col gap-3 rounded-panel border border-line-2 bg-surface p-5">
                      <header className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="num text-caption text-ink-3">{r.code}</p>
                          <h3 className="text-body font-semibold">{r.topic}</h3>
                        </div>
                        {out && <Badge tone={out.tone}>{out.label}</Badge>}
                      </header>
                      <p className="text-body text-ink">{r.rule}</p>
                      {(d.message_on_fail || d.override_by) && (
                        <div className="mt-auto space-y-1 border-t border-line-2 pt-3 text-label text-ink-2">
                          {d.message_on_fail && (
                            <p>
                              <span className="text-ink-3">Message shown: </span>
                              {d.message_on_fail}
                            </p>
                          )}
                          {d.override_by && <p className="text-ink-3">Can be overridden by {d.override_by}</p>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
