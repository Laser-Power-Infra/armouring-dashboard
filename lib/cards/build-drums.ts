// Cards 3 and 4 built in the app: the drum need from the Card 1 plan (Card 3 guide v4, 4.1), then the drums to
// assemble and their flanges (Card 4 guide v1, 4.1). Columns are read by heading, never by letter.
import { batchGet } from "../sheets/client.ts";
import { mapRows } from "../sheets/headers.ts";
import { addDays } from "./calendar.ts";
import { DRUM_DAYS, heldUp, raccoonNote } from "./drums.ts";
import { parseDrumStock, sizeKey, type Day, type DrumAssemblyRow, type DrumNeedRow, type DrumStockRow, type PlanRow } from "./sheet.ts";

const SHEETS = {
  S7: { id: "1AwxIYC73AGS2hLL0MEuXAdt2vhE7IWZEu5ELDTp-XBE", name: "KGP Finished Goods Drum Stock & Alternative", tab: "Drum Stock" },
  S8: { id: "1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI", name: "Armouring 5 – SFG Dashboard Data", tab: "Drum length" },
} as const;

/** Each grid starts at its header row. */
export type DrumGrids = { stock: unknown[][]; lengths: unknown[][] };

/** Reads both tabs. One error names every sheet that could not be read. */
export async function readDrumSources(): Promise<DrumGrids> {
  const keys = ["S7", "S8"] as const;
  const got = await Promise.allSettled(keys.map((k) => batchGet(SHEETS[k].id, [`'${SHEETS[k].tab}'`])));
  const failed = keys.flatMap((k, i) => (got[i].status === "rejected" ? [`${k} "${SHEETS[k].name}", tab "${SHEETS[k].tab}" (${SHEETS[k].id}): ${(got[i] as PromiseRejectedResult).reason?.message ?? got[i]}`] : []));
  if (failed.length) throw new Error(`Cannot read ${failed.length} sheet(s) – share them with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Viewer:\n  ${failed.join("\n  ")}`);
  const [[stock], [lengths]] = got.map((g) => (g as PromiseFulfilledResult<unknown[][][]>).value);
  return { stock: stock ?? [], lengths: lengths ?? [] };
}

const UNKNOWN = "Size not known";
const text = (v: unknown) => String(v ?? "").trim();
const whole = (n: number | null) => (n === null ? null : Math.round(n));
/** Guide 3.1: "84 X 35 X 38 X 3 + EXTRA SEGMENT" → "84×35×38×3 + extra segment". */
export const sizeText = (s: string) => s.replace(/\s+/g, " ").trim().replace(/ X /gi, "×").replace(/\+ EXTRA SEGMENT/i, "+ extra segment").replace(/ - RDSO/i, " RDSO");
/** A tab that cannot be read says which tab it is. */
const tab = <T>(k: keyof typeof SHEETS, f: () => T): T => {
  try {
    return f();
  } catch (e) {
    throw new Error(`${k} "${SHEETS[k].name}", tab "${SHEETS[k].tab}": ${(e as Error).message}`);
  }
};

/** Guide 3.3: the drum of each production order, from S8 "Drum length". A ref listed twice: the last row wins. */
function drumOfOrder(grid: unknown[][]) {
  const [head = [], ...rest] = grid;
  // Headings carry notes in brackets that change; the words before the bracket are the name.
  const rows = mapRows([head.map((h) => text(h).replace(/\s*\(.*$/, "")), ...rest], {
    size: { headers: ["Drum size"] }, refs: { headers: ["Order refs"] }, metres: { headers: ["Metres per drum"] }, note: { headers: ["Note on card"], optional: true },
  });
  const out = new Map<string, { size: string; km: number; note: string }>();
  for (const r of rows) {
    const metres = typeof r.metres === "number" ? r.metres : Number(text(r.metres).replace(/,/g, ""));
    if (!text(r.size)) continue;
    // No usable length for the drum: the guide's length for an order not in the tab (0.5 km).
    const drum = { size: sizeText(text(r.size)), km: metres > 0 ? metres / 1000 : 0.5, note: text(r.note) };
    for (const ref of text(r.refs).match(/\b\d{3}\b/g) ?? []) out.set(`P726Y-00${ref}`, drum);
  }
  return out;
}

const kind = (r: PlanRow) => (r.feedStatus === "drum" ? "raccoon" : (r.machine === "Extruder 51" || r.machine === "Extruder 52") && r.sizeCore === "OUTER sheath" ? "cable" : null);

export function planDrums(plan: PlanRow[], g: DrumGrids, d0: Day): { need: DrumNeedRow[]; assembly: DrumAssemblyRow[]; stock: DrumStockRow[] } {
  // One row per size (the table's key); figures are whole numbers.
  const stock = [...new Map(tab("S7", () => parseDrumStock(g.stock)).map((s) => [s.sizeKey, { ...s, drumSize: sizeText(s.drumSize), drums: whole(s.drums), flangesKgp: whole(s.flangesKgp), flangesPp: whole(s.flangesPp) }])).values()];
  const drumOf = tab("S8", () => drumOfOrder(g.lengths));

  // Guide 4.1 steps 1–4. Sorting keeps the plan's order within a day.
  const picked = plan.filter(kind).sort((a, b) => a.day.localeCompare(b.day));
  const lastSheath = new Map(picked.filter((r) => kind(r) === "cable").map((r) => [r.prodOrder, r.day]));
  const cum = new Map<string, number>();
  const counted = new Map<string, number>();
  const rows = picked.flatMap((r) => {
    const drum = drumOf.get(r.prodOrder);
    const raccoon = kind(r) === "raccoon";
    const km = (cum.get(r.prodOrder) ?? 0) + r.qty;
    cum.set(r.prodOrder, km);
    // 1e-9: quantities are decimals, so 0.3 / 0.2 must count as 1.5 and not as 1.4999….
    const drums = km / (drum?.km ?? 0.5);
    const total = raccoon || r.day === lastSheath.get(r.prodOrder) ? Math.ceil(drums - 1e-9) : Math.round(drums + 1e-9);
    const drumsNeeded = total - (counted.get(r.prodOrder) ?? 0);
    if (drumsNeeded <= 0) return [];
    counted.set(r.prodOrder, total);
    const readyBy = addDays(r.day, raccoon ? -1 : -4);
    if (readyBy >= addDays(d0, DRUM_DAYS)) return [];
    const note = raccoon ? raccoonNote(r.machine) : drum ? drum.note : "Plant to give the drum size";
    return [{ version: "", rowNo: 0, usedOn: r.day, readyBy, late: readyBy < d0, drumSize: drum?.size ?? UNKNOWN, drumsNeeded, fromStock: 0, toAssemble: 0, prodOrder: r.prodOrder, partyCable: r.partyCable, lot: r.lot, note: note || null }];
  });

  // Step 5, stock first, in the row order of the guide. "Size not known" has no stock.
  const left = new Map(stock.map((s) => [s.sizeKey, s.drums ?? 0]));
  const need: DrumNeedRow[] = rows
    .sort((a, b) => a.readyBy.localeCompare(b.readyBy) || a.usedOn.localeCompare(b.usedOn) || a.drumSize.localeCompare(b.drumSize) || a.prodOrder.localeCompare(b.prodOrder))
    .map((r, rowNo) => {
      const key = sizeKey(r.drumSize);
      const fromStock = r.drumSize === UNKNOWN ? 0 : Math.min(left.get(key) ?? 0, r.drumsNeeded);
      left.set(key, (left.get(key) ?? 0) - fromStock);
      return { ...r, rowNo, fromStock, toAssemble: r.drumsNeeded - fromStock };
    });

  // Card 4 guide 3 and 4.1: one row per need row still to assemble, by assemble-by date; late rows are due on day 0.
  const toMake: DrumAssemblyRow[] = need
    .filter((r) => r.toAssemble > 0)
    .map((r) => ({ version: "", rowNo: 0, assembleBy: r.late ? d0 : r.readyBy, was: r.late ? r.readyBy : null, drumSize: r.drumSize, drums: r.toAssemble, flangesNeeded: 2 * r.toAssemble, flangesFrom: "", prodOrder: r.prodOrder, partyCable: r.partyCable, lot: r.lot, usedOn: r.usedOn }))
    .sort((a, b) => a.assembleBy.localeCompare(b.assembleBy))
    .map((r, rowNo) => ({ ...r, rowNo }));
  const checked = heldUp(toMake, stock);
  return { need, assembly: toMake.map((r, i) => ({ ...r, flangesFrom: checked[i].flangesFrom })), stock };
}
