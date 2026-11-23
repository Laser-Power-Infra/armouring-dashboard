// Stores one card issue from the data sheet. Every issue is kept; loading a version again replaces only that issue.
import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { batchGet } from "../sheets/client.ts";
import { allocateLabour, readLabourSources, type LabourGrids } from "./build-labour.ts";
import { planDrums, readDrumSources, type DrumGrids } from "./build-drums.ts";
import { ddMonYy, dMon } from "./calendar.ts";
import { planCard1 } from "./plan.ts";
import { parseSources, pullCheck, readSources, storeSources, type Grids } from "./sources.ts";
import { parseCardPlan, parseDrumAssembly, parseDrumNeed, parseDrumStock, parseLabour, parseSpareMen, parseVersion } from "./sheet.ts";

export type CardTabs = Record<"plan" | "labour" | "spare" | "need" | "assembly" | "stock", unknown[][]>;

const TAB_NAMES: Record<keyof CardTabs, string> = {
  plan: "Card plan",
  labour: "Labour allocation",
  spare: "Spare men",
  need: "FG drum need",
  assembly: "Drum assembly",
  stock: "Drum stock",
};

export async function readCardTabs(spreadsheetId: string): Promise<CardTabs> {
  const keys = Object.keys(TAB_NAMES) as (keyof CardTabs)[];
  const grids = await batchGet(spreadsheetId, keys.map((k) => `'${TAB_NAMES[k]}'`));
  return Object.fromEntries(keys.map((k, i) => [k, grids[i]])) as CardTabs;
}

const date = (day: string) => new Date(day);

export async function loadCards(db: PrismaClient, tabs: CardTabs) {
  // Parse everything first: a bad tab stores nothing.
  const plan = parseCardPlan(tabs.plan);
  const labour = parseLabour(tabs.labour);
  const spare = parseSpareMen(tabs.spare);
  const need = parseDrumNeed(tabs.need);
  const assembly = parseDrumAssembly(tabs.assembly);
  const stock = parseDrumStock(tabs.stock);
  if (!plan.length) throw new Error("Card plan tab has no rows");

  const versions = [...new Set([plan, labour, spare, need, assembly].flat().map((r) => r.version))];
  if (versions.length !== 1) throw new Error(`The card tabs carry more than one version: ${versions.join(", ")}`);
  const version = versions[0];
  const d0 = plan.map((r) => r.day).sort()[0];
  const parsed = parseVersion(version, d0);

  return db.$transaction(
    async (tx) => {
      // The same version text for the same day 0 is the same issue. (The text carries no year, so it comes back every year.)
      const old = await tx.cardIssue.findUnique({ where: { version_d0: { version, d0: date(d0) } } });
      const last = await tx.cardIssue.aggregate({ where: { issueDate: date(parsed.issueDate) }, _max: { rev: true } });
      // The sheet's version text names the revision; when it does not, take the next number of that date.
      const rev = parsed.rev ?? old?.rev ?? (last._max.rev ?? 0) + 1;
      const data = { version, issueDate: date(parsed.issueDate), rev, d0: date(d0), loadedAt: new Date() };
      // An issue loaded again keeps its id, so links to it keep working; only its rows are replaced.
      const issue = old ? await tx.cardIssue.update({ where: { id: old.id }, data }) : await tx.cardIssue.create({ data });
      const issueId = issue.id;
      if (old) {
        const where = { where: { issueId } };
        await tx.cardPlan.deleteMany(where);
        await tx.cardLabour.deleteMany(where);
        await tx.cardSpareMen.deleteMany(where);
        await tx.cardDrumNeed.deleteMany(where);
        await tx.cardDrumAssembly.deleteMany(where);
        await tx.cardDrumStock.deleteMany(where);
      }
      await tx.cardPlan.createMany({ data: plan.map((r) => ({ ...drop(r), issueId, day: date(r.day) })) });
      await tx.cardLabour.createMany({ data: labour.map((r) => ({ ...drop(r), issueId, day: date(r.day) })) });
      await tx.cardSpareMen.createMany({ data: spare.map((r) => ({ ...drop(r), issueId, day: date(r.day) })) });
      await tx.cardDrumNeed.createMany({ data: need.map((r) => ({ ...drop(r), issueId, usedOn: date(r.usedOn), readyBy: date(r.readyBy) })) });
      await tx.cardDrumAssembly.createMany({
        data: assembly.map((r) => ({ ...drop(r), issueId, assembleBy: date(r.assembleBy), was: r.was ? date(r.was) : null, usedOn: date(r.usedOn) })),
      });
      await tx.cardDrumStock.createMany({ data: stock.map((r) => ({ ...r, issueId })) });

      return {
        issueId,
        version,
        issueDate: parsed.issueDate,
        rev,
        rows: { card_plan: plan.length, card_labour: labour.length, card_spare_men: spare.length, card_drum_need: need.length, card_drum_assembly: assembly.length, card_drum_stock: stock.length },
      };
    },
    { timeout: 60_000, maxWait: 20_000 }, // maxWait: a suspended Neon database takes several seconds to wake
  );
}

/** Every row table of an issue; the version lives on the issue row. */
const drop = <T extends { version: string }>(r: T): Omit<T, "version"> => {
  const copy: Partial<T> = { ...r };
  delete copy.version;
  return copy as Omit<T, "version">;
};

/** A card that cannot be built gives its reason; the other cards are still issued. */
const attempt = async <T>(f: () => Promise<T>): Promise<{ ok: T; problem: null } | { ok: null; problem: string }> => {
  try {
    return { ok: await f(), problem: null };
  } catch (e) {
    return { ok: null, problem: (e as Error).message };
  }
};

export type BuildOptions = {
  now?: Date;
  /** The issuer's text for this version. */
  note?: string;
  /** Scheduled runs: store no new revision when the cards would come out the same as the latest issue. */
  ifChanged?: boolean; read?: () => Promise<Grids>; readLabour?: () => Promise<LabourGrids>; readDrums?: () => Promise<DrumGrids> };

/**
 * The four cards built in the app: sync the sheets, plan Card 1, then place the men (Card 2) and count the
 * drums (Cards 3 and 4) from that plan. Day 0 is today in plant time. Every build is a new revision of today's issue.
 */
export async function buildCards(db: PrismaClient, { now = new Date(), note = "", ifChanged = false, read = readSources, readLabour = readLabourSources, readDrums = readDrumSources }: BuildOptions = {}) {
  const grids = await read().catch(async (e) => {
    await db.syncRun.create({ data: { source: "S1 S3 S4 S8", tab: "*", rows: 0, ok: false } });
    throw e;
  });
  const tables = parseSources(grids);
  const pull = pullCheck(grids.readme, now);
  await storeSources(db, tables, pull.pulledAt);
  if (pull.problem) throw new Error(`Cards not built: ${pull.problem}`);

  const d0 = new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const { rows, notPlanned } = planCard1(tables, d0);
  if (!rows.length) throw new Error("Cards not built: the plan has no job lines");
  const [men, drums] = await Promise.all([
    attempt(async () => {
      const g = await readLabour();
      const placed = allocateLabour(rows, g, d0);
      return { ...placed, rosterName: `${g.rosterName} ends ${dMon(placed.rosterEnds)}` };
    }),
    attempt(async () => planDrums(rows, await readDrums(), d0)),
  ]);
  // Same day 0 and the same rows and reasons = the same cards. The SFG pull time is left out: a new pull of the same data changes nothing.
  const fingerprint = createHash("sha256").update(JSON.stringify({ d0, rows, notPlanned, men, drums })).digest("hex");
  return db.$transaction(
    async (tx) => {
      const prev = await tx.cardIssue.findFirst({ orderBy: [{ issueDate: "desc" }, { rev: "desc" }], select: { id: true, version: true, fingerprint: true } });
      if (ifChanged && prev?.fingerprint === fingerprint) return { issueId: prev.id, version: prev.version, d0, unchanged: true as const, jobLines: rows.length, notPlanned, labourProblem: men.problem ?? men.ok?.warning ?? null, drumProblem: drums.problem };
      const last = await tx.cardIssue.aggregate({ where: { issueDate: date(d0) }, _max: { rev: true } });
      const rev = (last._max.rev ?? 0) + 1;
      const version = `${ddMonYy(d0)} / Rev ${rev}`;
      const issue = await tx.cardIssue.create({
        data: { version, issueDate: date(d0), rev, d0: date(d0), s8PulledAt: pull.pulledAt, notPlanned, fingerprint, prevIssueId: prev?.id, issueNote: note.trim(), review: true, rosterName: men.ok?.rosterName, labourProblem: men.problem ?? men.ok?.warning, drumProblem: drums.problem },
      });
      const issueId = issue.id;
      await tx.cardPlan.createMany({ data: rows.map((r) => ({ ...drop(r), issueId, day: date(r.day) })) });
      if (men.ok) {
        await tx.cardLabour.createMany({ data: men.ok.labour.map((r) => ({ ...drop(r), issueId, day: date(r.day) })) });
        await tx.cardSpareMen.createMany({ data: men.ok.spare.map((r) => ({ ...drop(r), issueId, day: date(r.day) })) });
      }
      if (drums.ok) {
        await tx.cardDrumNeed.createMany({ data: drums.ok.need.map((r) => ({ ...drop(r), issueId, usedOn: date(r.usedOn), readyBy: date(r.readyBy) })) });
        await tx.cardDrumAssembly.createMany({ data: drums.ok.assembly.map((r) => ({ ...drop(r), issueId, assembleBy: date(r.assembleBy), was: r.was ? date(r.was) : null, usedOn: date(r.usedOn) })) });
        await tx.cardDrumStock.createMany({ data: drums.ok.stock.map((r) => ({ ...r, issueId })) });
      }
      return { issueId, version, d0, unchanged: false as const, jobLines: rows.length, notPlanned, labourProblem: men.problem ?? men.ok?.warning ?? null, drumProblem: drums.problem };
    },
    { timeout: 60_000, maxWait: 20_000 }, // maxWait: a suspended Neon database takes several seconds to wake
  );
}
