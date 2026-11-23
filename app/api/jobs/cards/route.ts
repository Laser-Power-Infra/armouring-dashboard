import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { buildCards } from "@/lib/cards/load";

// Scheduled card sync (documentation.md §8): syncs the source sheets into the database, then builds today's four
// cards. A new revision is stored only when the cards changed, so the scheduler can call this as often as it likes.
// Two runs at once cannot store the same revision twice: (issue date, rev) is unique, so the later one fails and is retried.
export const maxDuration = 300;

const hash = (s: string) => createHash("sha256").update(s).digest();

/** Bearer JOB_SECRET, compared in constant time. No secret set = the job is closed. */
function authorized(req: Request) {
  const secret = process.env.JOB_SECRET;
  const given = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return !!secret && !!given && timingSafeEqual(hash(given), hash(secret));
}

/** Credential probe for the scheduler: checks the secret, runs nothing. */
export function GET(req: Request) {
  return authorized(req) ? Response.json({ ok: true, auth: "ok" }) : Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const r = await buildCards(db, { ifChanged: true });
    // A card that could not be built still leaves the others issued; its reason is reported, not failed on.
    return Response.json({
      ok: true,
      results: [
        {
          source: "cards",
          rows: r.jobLines,
          status: r.unchanged ? "unchanged" : "built",
          version: r.version,
          issueId: r.issueId,
          error: null,
          labourProblem: r.labourProblem,
          drumProblem: r.drumProblem,
          notPlanned: r.notPlanned.length,
        },
      ],
    });
  } catch (e) {
    // Sheets not readable, SFG pull failed or too old, plan empty: non-2xx so the scheduler retries and alerts.
    return Response.json({ ok: false, results: [{ source: "cards", rows: 0, status: "failed", error: (e as Error).message }] }, { status: 500 });
  }
}
