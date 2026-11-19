import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getCardPlan, getDrums, getIssues, getLabour, versionLabel } from "../../lib/cards/data";
import { loadCards } from "../../lib/cards/load";
import { parseCardPlan } from "../../lib/cards/sheet";
import { fixtureTabs, testDb, url, withVersion } from "./testdb";

describe.skipIf(!url)("loading card issues", () => {
  const db = testDb();
  beforeEach(() => db.cardIssue.deleteMany(), 60_000);
  afterAll(() => db.$disconnect());

  it("stores an issue with its version, revision and rows", async () => {
    const r = await loadCards(db, fixtureTabs());
    expect(r).toMatchObject({ version: "17-Nov R2 plan", issueDate: "2026-11-17", rev: 2 });
    expect(r.rows).toEqual({ card_plan: 271, card_labour: 282, card_spare_men: 28, card_drum_need: 42, card_drum_assembly: 36, card_drum_stock: 10 });
    const issue = await db.cardIssue.findUniqueOrThrow({ where: { id: r.issueId } });
    expect(issue.d0.toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(await db.cardPlan.count({ where: { issueId: r.issueId } })).toBe(271);
  }, 60_000);

  it("keeps older issues, and replaces only the issue loaded again", async () => {
    const a = await loadCards(db, fixtureTabs());
    const b = await loadCards(db, withVersion(fixtureTabs(), "VERSION 18-Nov-26 / Rev 1"));
    expect(b).toMatchObject({ issueDate: "2026-11-18", rev: 1 });
    expect(await db.cardIssue.count()).toBe(2);
    expect(await db.cardLabour.count()).toBe(564);
    await loadCards(db, fixtureTabs());
    expect(await db.cardIssue.count()).toBe(2);
    expect(await db.cardLabour.count()).toBe(564);
    expect(await db.cardPlan.count({ where: { issueId: a.issueId } })).toBe(0); // the old copy of that issue is gone
    expect(await db.cardPlan.count({ where: { issueId: b.issueId } })).toBe(271);
  }, 120_000);

  it("numbers an issue itself when the version text has no revision", async () => {
    await loadCards(db, fixtureTabs()); // 17-Nov Rev 2
    const next = await loadCards(db, withVersion(fixtureTabs(), "17-Nov plan"));
    expect(next).toMatchObject({ issueDate: "2026-11-17", rev: 3 });
    expect((await loadCards(db, withVersion(fixtureTabs(), "17-Nov plan"))).rev).toBe(3); // same issue again keeps its number
  }, 120_000);

  it("stores nothing when the tabs disagree on the version", async () => {
    const tabs = fixtureTabs();
    const mixed = { ...tabs, labour: withVersion(tabs, "18-Nov R1").labour };
    await expect(loadCards(db, mixed)).rejects.toThrow(/more than one version: 17-Nov R2 plan, 18-Nov R1/);
    expect(await db.cardIssue.count()).toBe(0);
  }, 60_000);

  it("reads issues newest first, and each card's rows for the asked issue only, in sheet order", async () => {
    expect(await getIssues(db)).toEqual([]);
    const a = await loadCards(db, fixtureTabs()); // 17-Nov Rev 2
    const b = await loadCards(db, withVersion(fixtureTabs(), "18-Nov R1"));
    const c = await loadCards(db, withVersion(fixtureTabs(), "18-Nov R2"));
    const issues = await getIssues(db);
    expect(issues.map((i) => i.id)).toEqual([c.issueId, b.issueId, a.issueId]);
    expect(versionLabel(issues[0])).toBe("VERSION 18-Nov-26 / Rev 2");
    expect(issues[2]).toMatchObject({ version: "17-Nov R2 plan", issueDate: "2026-11-17", rev: 2, d0: "2026-11-17" });
    // What comes back from the database is what was parsed from the sheet.
    expect(await getCardPlan(db, a.issueId)).toMatchObject(parseCardPlan(fixtureTabs().plan));
    const { labour, spare } = await getLabour(db, a.issueId);
    expect([labour.length, spare.length, labour[0].machine, labour[0].day]).toEqual([282, 28, "WD14", "2026-11-18"]);
    const drums = await getDrums(db, a.issueId);
    expect([drums.need.length, drums.assembly.length, drums.stock.length]).toEqual([42, 36, 10]);
    expect(drums.assembly[0]).toMatchObject({ assembleBy: "2026-11-17", was: "2026-11-13", drums: 4 });
  }, 180_000);
});
