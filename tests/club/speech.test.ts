import { describe, expect, it } from "vitest";
import { proposalSpeech } from "../../lib/club/speech";
import type { Check, Suggestion } from "../../lib/club/insight";

const check = (label: string, ok: boolean, blocking = true): Check => ({ code: "CR-E-31", label, ok, order: "", lot: "", blocking });
const sug = (lotNo: string, checks: Check[], fgReady: string | null, laterDelayDays = 0): Suggestion => ({ lotNo, checks, fits: checks.every((c) => c.ok || !c.blocking), fgReady, laterDelayDays, later: [] });

describe("read aloud text", () => {
  it("speaks each proposal with its failing checks, dates and the new-lot option", () => {
    const text = proposalSpeech(
      { prodOrder: "P726Y-00260", party: "ABC Ltd", km: 3.5 },
      [sug("PL-004", [check("Conductor size", true), check("Insulation", true, false)], "2026-11-28"), sug("PL-006", [check("Conductor size (sq mm)", false), check("Armour", false)], "2026-12-02", 1)],
      "2026-12-05",
    );
    expect(text).toBe(
      "Order P726Y-00260, party ABC Ltd, 3.5 km. पहला option: lot PL-004. सारे checks pass हैं। FG ready लगभग 28 November। " +
        "दूसरा option: lot PL-006. 2 check fail हैं: Conductor size, Armour। FG ready लगभग 2 December। बाद के lots लगभग 1 दिन आगे खिसकेंगे। " +
        "नया lot बनाएं तो FG ready लगभग 5 December, MD approval के बाद।",
    );
  });
  it("says when no lot fits and a date is not known", () => {
    expect(proposalSpeech({ prodOrder: "P1", party: null, km: 1 }, [sug("PL-1", [check("Size", false)], null)], null)).toBe(
      "Order P1, 1 km. कोई चालू या आने वाला lot fit नहीं हो रहा। पहला option: lot PL-1. 1 check fail हैं: Size। FG ready लगभग अभी पता नहीं। नया lot बनाएं तो FG ready लगभग अभी पता नहीं, MD approval के बाद।",
    );
  });
});
