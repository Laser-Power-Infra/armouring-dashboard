import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadCards } from "../../lib/cards/load";
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
});
