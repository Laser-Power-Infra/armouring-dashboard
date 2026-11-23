// Card 1 sources: reads the Google Sheets of docs/final guide for card 1.md (sections 1–3) and stores them.
// Columns are taken by letter, as the guide gives them.
import type { PrismaClient } from "../generated/prisma/client.ts";
import { batchGet } from "../sheets/client.ts";
import { MACHINE_ORDER, MACHINES } from "./machines.ts";

export const SHEETS = {
  S1: { id: "1fOY-x0tEh20S8jC2cHg2LkaF8N1bGAcHYGaKJNlF_30", name: "KGP Production Lots – Club & Run Together", ranges: ["Lots!A2:L", "Orders!A2:V"] },
  S3: { id: "1tJ8rwKBSIft0E2_kZWDT1Be-i0Q3NBlW2N29Y2nThb0", name: "KGP RM Control – Opening Stock", ranges: ["'Opening Stock'!A2:L"] },
  S4: { id: "1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg", name: "KHG Machines to Run Daily", ranges: ["Machines!A7:N"] },
  S8: { id: "1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI", name: "Armouring 5 – SFG Dashboard Data", ranges: ["'Order lines'!A2:P", "'Material per item'!A2:I", "README!B2"] },
} as const;

type Grid = unknown[][];
export type Grids = { lots: Grid; orders: Grid; rm: Grid; men: Grid; lines: Grid; bom: Grid; readme: string };

export type Tables = {
  lots: { lotNo: string; runOrder: number; approvedByMd: boolean }[];
  orders: { prodOrder: string; mcNo: string | null; party: string | null; cable: string | null; sizeSqmm: number | null; cores: number | null; insulation: string | null; lotNo: string | null; runOrderInLot: number | null; supplyFrom: string | null }[];
  lines: { prodOrder: string; fgType: string | null; stage: string; sfgCode: string; sfgItem: string; netQty: number; doneQty: number; balance: number; scope: string | null; sfgBom: string | null }[];
  bom: { sfgBom: string; lineNo: number; materialCode: string; material: string; kgPerKm: number }[];
  rm: { itemCode: string; item: string; qtyForPlanning: number }[];
  men: { machine: string; menPerShift: number | null; mustRunDaily: boolean }[];
};

/** Reads every sheet. One error names every sheet that could not be read. */
export async function readSources(): Promise<Grids> {
  const keys = Object.keys(SHEETS) as (keyof typeof SHEETS)[];
  const got = await Promise.allSettled(keys.map((k) => batchGet(SHEETS[k].id, [...SHEETS[k].ranges])));
  const failed = keys.flatMap((k, i) => (got[i].status === "rejected" ? [`${k} "${SHEETS[k].name}" (${SHEETS[k].id}): ${(got[i] as PromiseRejectedResult).reason?.message ?? got[i]}`] : []));
  if (failed.length) throw new Error(`Cannot read ${failed.length} sheet(s) – share them with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Viewer:\n  ${failed.join("\n  ")}`);
  const [[lots, orders], [rm], [men], [lines, bom, readme]] = got.map((g) => (g as PromiseFulfilledResult<Grid[]>).value);
  return { lots, orders, rm, men, lines, bom, readme: String(readme[0]?.[0] ?? "") };
}

const text = (v: unknown) => String(v ?? "").trim();
const textOrNull = (v: unknown) => text(v) || null;
/** "-" or blank is no number; commas are removed. */
const num = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = text(v).replace(/,/g, "");
  return s === "" || s === "-" || !Number.isFinite(Number(s)) ? null : Number(s);
};
const yes = (v: unknown) => v === true || text(v).toUpperCase() === "TRUE";

/** Sync rules of the guide, 3.2. */
export function parseSources(g: Grids): Tables {
  const has = (col: number) => (r: unknown[]) => text(r[col]) !== "";
  return {
    lots: g.lots.filter(has(1)).map((r) => ({ lotNo: text(r[1]), runOrder: Math.round(num(r[0]) ?? 0), approvedByMd: yes(r[8]) })),
    orders: g.orders.filter(has(0)).map((r) => {
      const run = num(r[18]);
      return { prodOrder: text(r[0]), mcNo: textOrNull(r[1]), party: textOrNull(r[2]), cable: textOrNull(r[3]), sizeSqmm: num(r[4]), cores: num(r[5]), insulation: textOrNull(r[7]), lotNo: textOrNull(r[17]), runOrderInLot: run === null ? null : Math.round(run), supplyFrom: textOrNull(r[20]) };
    }),
    lines: g.lines.filter(has(0)).map((r) => ({ prodOrder: text(r[0]), fgType: textOrNull(r[5]), stage: text(r[7]), sfgCode: text(r[8]), sfgItem: text(r[9]), netQty: num(r[10]) ?? 0, doneQty: num(r[11]) ?? 0, balance: num(r[12]) ?? 0, scope: textOrNull(r[14]), sfgBom: textOrNull(r[15]) })),
    bom: g.bom.filter(has(0)).map((r) => ({ sfgBom: text(r[0]), lineNo: num(r[4]) ?? 0, materialCode: text(r[5]), material: text(r[6]), kgPerKm: num(r[7]) ?? 0 })),
    rm: g.rm.filter(has(2)).map((r) => ({ itemCode: text(r[2]), item: text(r[3]), qtyForPlanning: num(r[11]) ?? 0 })),
    // Men per shift = F; if blank, the number after "Day: mostly" in G; if neither, not known (guide 2.6).
    men: MACHINE_ORDER.flatMap((machine) => {
      const r = g.men.find((x) => text(x[0]) === MACHINES[machine].s4);
      if (!r) return [];
      const mostly = /Day:\s*mostly\s*(\d+)/i.exec(text(r[6]));
      return [{ machine, menPerShift: num(r[5]) ?? (mostly ? Number(mostly[1]) : null), mustRunDaily: yes(r[3]) }];
    }),
  };
}

/** README!B2 of S8: when the SFG pull ran, and why the cards must not be built from it (guide 3.2), if so. */
export function pullCheck(readme: string, now: Date): { pulledAt: string; problem: string | null } {
  const m = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) IST/.exec(readme);
  const pulledAt = m ? m[0] : readme.slice(0, 60);
  if (/skipped|failed/i.test(readme)) return { pulledAt, problem: `the SFG pull says "${readme}"` };
  if (!m) return { pulledAt, problem: `README!B2 carries no pull time: "${readme}"` };
  const hours = (now.getTime() - Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 5, +m[5] - 30)) / 3_600_000;
  return { pulledAt, problem: hours > 18 ? `the SFG pull of ${pulledAt} is ${hours.toFixed(1)} h old (limit 18 h)` : null };
}

/** Replaces each table whole and logs the sync. */
export async function storeSources(db: PrismaClient, t: Tables, s8PulledAt: string) {
  await db.$transaction(
    async (tx) => {
      await tx.kgpLot.deleteMany();
      await tx.kgpOrder.deleteMany();
      await tx.kgpOrderLine.deleteMany();
      await tx.bomLine.deleteMany();
      await tx.rmStock.deleteMany();
      await tx.machineMen.deleteMany();
      await tx.kgpLot.createMany({ data: t.lots });
      await tx.kgpOrder.createMany({ data: t.orders });
      await tx.kgpOrderLine.createMany({ data: t.lines });
      await tx.bomLine.createMany({ data: t.bom });
      await tx.rmStock.createMany({ data: t.rm });
      await tx.machineMen.createMany({ data: t.men });
      const log = (source: string, tab: string, rows: number) => ({ source, tab, rows, ok: true, s8PulledAt });
      await tx.syncRun.createMany({
        data: [log("S1", "Lots", t.lots.length), log("S1", "Orders", t.orders.length), log("S8", "Order lines", t.lines.length), log("S8", "Material per item", t.bom.length), log("S3", "Opening Stock", t.rm.length), log("S4", "Machines", t.men.length)],
      });
    },
    { timeout: 60_000 },
  );
}
