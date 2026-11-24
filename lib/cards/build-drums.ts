// Cards 3 and 4 built in the app: the drum need from the Card 1 plan (Card 3 guide v4, 4.1), then the drums to
// assemble and their flanges (Card 4 guide v1, 4.1), with the drum size source update of 24-Nov-26: each order's
// drum comes from the RAW MATERIALS REQUIREMENT sheet (table RaccoonDrum), and S7 gives stock and flanges by drum code.
import { batchGet } from "../sheets/client.ts";
import { addDays } from "./calendar.ts";
import { DRUM_DAYS, heldUp, MISSING, raccoonNote } from "./drums.ts";
import { codeOf, parseDrumStock, type Day, type DrumAssemblyRow, type DrumNeedRow, type DrumStockRow, type PlanRow } from "./sheet.ts";

export const DRUM_SHEETS = {
  S7: { id: "1AwxIYC73AGS2hLL0MEuXAdt2vhE7IWZEu5ELDTp-XBE", name: "KGP Finished Goods Drum Stock & Alternative", tab: "Drum Stock" },
} as const;

/** The grid starts at its header row. */
export type DrumGrids = { stock: unknown[][] };
/** The drum of a production order (RaccoonDrum). */
export type OrderDrum = { prodOrder: string; drumCode: string; drumSize: string; drumKm: number };

export async function readDrumSources(): Promise<DrumGrids> {
  const { id, name, tab } = DRUM_SHEETS.S7;
  const [stock] = await batchGet(id, [`'${tab}'`]).catch((e) => {
    throw new Error(`Cannot read S7 "${name}", tab "${tab}" (${id}): ${e?.message ?? e} – share it with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Viewer`);
  });
  return { stock: stock ?? [] };
}

const whole = (n: number | null) => (n === null ? null : Math.round(n));
/**
 * Guide 3.1: RM AS "DRUM - 48 X 20 X 28 X 2.25 - RDSO" → "48×20×28×2.25 RDSO". A leading "DRUM - " / "DRUM " goes;
 * "STEEL DRUM - …" stays.
 */
export const sizeText = (s: string) =>
  s.replace(/\s+/g, " ").trim().replace(/^DRUM -? ?/i, "").replace(/ X /gi, "×").replace(/\+ EXTRA SEGMENT/i, "+ extra segment").replace(/ - RDSO/i, " RDSO");

const kind = (r: PlanRow) => (r.feedStatus === "drum" ? "raccoon" : (r.machine === "Extruder 51" || r.machine === "Extruder 52") && r.sizeCore === "OUTER sheath" ? "cable" : null);

export function planDrums(plan: PlanRow[], g: DrumGrids, d0: Day, drums: OrderDrum[]): { need: DrumNeedRow[]; assembly: DrumAssemblyRow[]; stock: DrumStockRow[] } {
  // One row per drum code (the table's key); figures are whole numbers.
  let parsed: DrumStockRow[];
  try {
    parsed = parseDrumStock(g.stock, true);
  } catch (e) {
    throw new Error(`S7 "${DRUM_SHEETS.S7.name}", tab "${DRUM_SHEETS.S7.tab}": ${(e as Error).message}`);
  }
  const stock = [...new Map(parsed.map((s) => [s.drumCode, { ...s, drums: whole(s.drums), flangesKgp: whole(s.flangesKgp), flangesPp: whole(s.flangesPp) }])).values()];
  const drumOf = new Map(drums.map((d) => [d.prodOrder, d]));

  // Guide 4.1 steps 1–4. Sorting keeps the plan's order within a day.
  const picked = plan.filter(kind).sort((a, b) => a.day.localeCompare(b.day));
  const lastSheath = new Map(picked.filter((r) => kind(r) === "cable").map((r) => [r.prodOrder, r.day]));
  const cum = new Map<string, number>();
  const counted = new Map<string, number>();
  const rows = picked.flatMap((r): Omit<DrumNeedRow, "rowNo">[] | DrumNeedRow[] => {
    const drum = drumOf.get(r.prodOrder);
    const raccoon = kind(r) === "raccoon";
    const readyBy = addDays(r.day, raccoon ? -1 : -4);
    if (readyBy >= addDays(d0, DRUM_DAYS)) return [];
    const base = { version: "", rowNo: 0, usedOn: r.day, readyBy, late: readyBy < d0, fromStock: 0, toAssemble: 0, prodOrder: r.prodOrder, partyCable: r.partyCable, lot: r.lot };
    // No drum in the RM sheet: no drums counted. One row of 0 drums is kept so Card 3 can list the order (MISSING).
    if (!drum) {
      if (counted.has(r.prodOrder)) return [];
      counted.set(r.prodOrder, 0);
      return [{ ...base, drumSize: MISSING, drumCode: null, drumsNeeded: 0, note: null }];
    }
    const km = (cum.get(r.prodOrder) ?? 0) + r.qty;
    cum.set(r.prodOrder, km);
    // 1e-9: quantities are decimals, so 0.3 / 0.2 must count as 1.5 and not as 1.4999….
    const n = km / drum.drumKm;
    const total = raccoon || r.day === lastSheath.get(r.prodOrder) ? Math.ceil(n - 1e-9) : Math.round(n + 1e-9);
    const drumsNeeded = total - (counted.get(r.prodOrder) ?? 0);
    if (drumsNeeded <= 0) return [];
    counted.set(r.prodOrder, total);
    return [{ ...base, drumSize: drum.drumSize, drumCode: drum.drumCode, drumsNeeded, note: raccoon ? raccoonNote(r.machine) : null }];
  });

  // Step 5, stock first, in the row order of the guide, per drum code (a code not in S7 has none).
  const left = new Map(stock.map((s) => [s.drumCode, s.drums ?? 0]));
  const need: DrumNeedRow[] = rows
    .sort((a, b) => a.readyBy.localeCompare(b.readyBy) || a.usedOn.localeCompare(b.usedOn) || a.drumSize.localeCompare(b.drumSize) || a.prodOrder.localeCompare(b.prodOrder))
    .map((r, rowNo) => {
      const key = codeOf(r);
      const fromStock = Math.min(left.get(key) ?? 0, r.drumsNeeded);
      left.set(key, (left.get(key) ?? 0) - fromStock);
      return { ...r, rowNo, fromStock, toAssemble: r.drumsNeeded - fromStock };
    });

  // Card 4 guide 3 and 4.1: one row per need row still to assemble, by assemble-by date; late rows are due on day 0.
  const toMake: DrumAssemblyRow[] = need
    .filter((r) => r.toAssemble > 0)
    .map((r) => ({ version: "", rowNo: 0, assembleBy: r.late ? d0 : r.readyBy, was: r.late ? r.readyBy : null, drumSize: r.drumSize, drumCode: r.drumCode, drums: r.toAssemble, flangesNeeded: 2 * r.toAssemble, flangesFrom: "", prodOrder: r.prodOrder, partyCable: r.partyCable, lot: r.lot, usedOn: r.usedOn }))
    .sort((a, b) => a.assembleBy.localeCompare(b.assembleBy))
    .map((r, rowNo) => ({ ...r, rowNo }));
  const checked = heldUp(toMake, stock);
  return { need, assembly: toMake.map((r, i) => ({ ...r, flangesFrom: checked[i].flangesFrom })), stock };
}
