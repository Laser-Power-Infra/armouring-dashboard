// What Read aloud says for one waiting order's lot proposals (New orders page), in Hinglish as the plant talks.
// Hindi words are in Devanagari so the voice says them as Hindi; plant terms (lot, FG, checks) stay in English.
import { failed, type Suggestion } from "./insight.ts";

type Day = string; // YYYY-MM-DD

const ORDINAL = ["पहला", "दूसरा", "तीसरा", "चौथा"];

/** "2026-11-28" -> "28 November", spoken plainly. */
const spokenDay = (d: Day | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" }) : "अभी पता नहीं");

export function proposalSpeech(o: { prodOrder: string; party: string | null; km: number }, sug: Suggestion[], newLotFg: Day | null) {
  const parts = [`Order ${o.prodOrder}${o.party ? `, party ${o.party}` : ""}, ${o.km} km.`];
  if (!sug.some((s) => s.fits)) parts.push("कोई चालू या आने वाला lot fit नहीं हो रहा।");
  sug.forEach((s, i) => {
    const fails = failed(s.checks);
    const checks = fails.length ? `${fails.length} check fail हैं: ${fails.map((c) => c.label.replace(/\s*\(.*?\)/g, "")).join(", ")}।` : "सारे checks pass हैं।";
    const later = s.laterDelayDays > 0 ? ` बाद के lots लगभग ${s.laterDelayDays} दिन आगे खिसकेंगे।` : "";
    parts.push(`${ORDINAL[i] ?? `Option ${i + 1}`} option: lot ${s.lotNo}. ${checks} FG ready लगभग ${spokenDay(s.fgReady)}।${later}`);
  });
  parts.push(`नया lot बनाएं तो FG ready लगभग ${spokenDay(newLotFg)}, MD approval के बाद।`);
  return parts.join(" ");
}
