// Stores one card issue from the data sheet. Every issue is kept; loading a version again replaces only that issue.
import type { PrismaClient } from "../generated/prisma/client.ts";
import { batchGet } from "../sheets/client.ts";
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
      // The version lives on the issue row, not on every data row.
      const drop = <T extends { version: string }>(r: T): Omit<T, "version"> => {
        const copy: Partial<T> = { ...r };
        delete copy.version;
        return copy as Omit<T, "version">;
      };

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
    { timeout: 60_000 },
  );
}
