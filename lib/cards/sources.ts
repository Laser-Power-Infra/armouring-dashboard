// Card 1 sources: reads the Google Sheets of docs/final guide for card 1.md (sections 1–3) and stores them.
// Columns are taken by letter, as the guide gives them.
import type { PrismaClient } from "../generated/prisma/client.ts";
import { batchGet } from "../sheets/client.ts";
import { MACHINE_ORDER, MACHINES } from "./machines.ts";
import { sizeText } from "./build-drums.ts";
import { CLUB_COMPARE, CLUB_MASTER, compareSheet, refreshClub, type SfgOrder } from "../club/club.ts";

export const SHEETS = {
  S1: { id: "1fOY-x0tEh20S8jC2cHg2LkaF8N1bGAcHYGaKJNlF_30", name: "KGP Production Lots – Club & Run Together", ranges: ["Lots!A2:L", "Orders!A2:V"] },
  S3: { id: "1tJ8rwKBSIft0E2_kZWDT1Be-i0Q3NBlW2N29Y2nThb0", name: "KGP RM Control – Opening Stock", ranges: ["'Opening Stock'!A2:L"] },
  S4: { id: "1EiRA3GUfM0aI7Mp1IpPDqnK41L3PBWN-nvje7AK3dWg", name: "KHG Machines to Run Daily", ranges: ["Machines!A7:N"] },
  S8: { id: "1V5YkE3ukRRib_1hlUU3xDTZuskJaYCXMPPcbqIeKPPI", name: "Armouring 5 – SFG Dashboard Data", ranges: ["'Order lines'!A2:Q", "'Material per item'!A2:I", "README!B2"] },
  RM: { id: "1LYLR9h7LiWtqsFYS0eeBvrm-li-6XLUWm56R3KYMfSw", name: "Samrat_VINAY-DHIRAJ-RAW MATERIAL REQUIREMENT", ranges: ["'RAW MATERIALS REQUIREMENT'!A3:AS"] },
} as const;

type Grid = unknown[][];
export type Grids = { lots: Grid; orders: Grid; rm: Grid; men: Grid; lines: Grid; bom: Grid; readme: string; rmReq?: Grid };

/** The Club & Run columns kept only for display; the planner never reads them. */
type LotRest = { whatClubbed: string | null; created: Date | null; orders: number | null; balanceKm: number | null; conductorPendingCoreKm: number | null; insulationPendingCoreKm: number | null; sentToPlant: boolean; status: string | null; remarks: string | null };
type OrderRest = { armour: string | null; orderDate: Date | null; approved: string | null; conductorBalCoreKm: number | null; insulationBalCoreKm: number | null; layingBalKm: number | null; innerBalKm: number | null; armouringBalKm: number | null; finishBalKm: number | null; pendingFrom: string | null; remarks: string | null; suggestedLot: string | null };

export type Tables = {
  lots: ({ lotNo: string; runOrder: number; approvedByMd: boolean } & Partial<LotRest>)[];
  orders: ({ prodOrder: string; mcNo: string | null; party: string | null; cable: string | null; sizeSqmm: number | null; cores: number | null; insulation: string | null; lotNo: string | null; runOrderInLot: number | null; supplyFrom: string | null } & Partial<OrderRest>)[];
  lines: { prodOrder: string; fgType: string | null; stage: string; sfgCode: string; sfgItem: string; netQty: number; doneQty: number; balance: number; scope: string | null; sfgBom: string | null; fgItemCode?: string | null; contractNo?: string | null }[];
  /** The FG drum of each production order, from the RAW MATERIALS REQUIREMENT sheet; an order with none has no row. */
  drums: { prodOrder: string; contractNo: string; drumCode: string; drumSize: string; drumKm: number }[];
  /** One row per order in the SFG pull: what a new Club & Run order is made from. */
  sfgOrders: SfgOrder[];
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
  const [[lots, orders], [rm], [men], [lines, bom, readme], [rmReq]] = got.map((g) => (g as PromiseFulfilledResult<Grid[]>).value);
  return { lots, orders, rm, men, lines, bom, readme: String(readme[0]?.[0] ?? ""), rmReq };
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
/** A Sheets serial day (counted from 30-Dec-1899); anything else is no date. */
const day = (v: unknown) => (typeof v === "number" ? new Date(Date.UTC(1899, 11, 30 + Math.floor(v))) : null);

/**
 * Drum source update of 24-Nov-26: each production order's contract (Order lines Q) and FG item (N), from any of its
 * rows, matched to RM B + E. No contract, no RM row, or AR / AO blank: no row – the cards say the size is missing.
 */
function drumsOf(lines: Grid, rmReq: Grid): Tables["drums"] {
  const rm = new Map(rmReq.filter((r) => text(r[1])).map((r) => [`${text(r[1])}|${text(r[4])}`, r]));
  const orders = new Map(lines.filter((r) => text(r[0]) && text(r[16])).map((r) => [text(r[0]), r]));
  return [...orders].flatMap(([prodOrder, r]) => {
    const m = rm.get(`${text(r[16])}|${text(r[13])}`);
    const metres = m && num(m[40]);
    return m && text(m[43]) && metres ? [{ prodOrder, contractNo: text(r[16]), drumCode: text(m[43]), drumSize: sizeText(text(m[44])), drumKm: metres / 1000 }] : [];
  });
}

/** Sync rules of the guide, 3.2. */
export function parseSources(g: Grids): Tables {
  const has = (col: number) => (r: unknown[]) => text(r[col]) !== "";
  return {
    drums: drumsOf(g.lines, g.rmReq ?? []),
    lots: g.lots.filter(has(1)).map((r) => {
      const n = num(r[4]);
      return {
        lotNo: text(r[1]), runOrder: Math.round(num(r[0]) ?? 0), approvedByMd: yes(r[8]),
        whatClubbed: textOrNull(r[2]), created: day(r[3]), orders: n === null ? null : Math.round(n), balanceKm: num(r[5]), conductorPendingCoreKm: num(r[6]), insulationPendingCoreKm: num(r[7]), sentToPlant: yes(r[9]), status: textOrNull(r[10]), remarks: textOrNull(r[11]),
      };
    }),
    orders: g.orders.filter(has(0)).map((r) => {
      const run = num(r[18]);
      return {
        prodOrder: text(r[0]), mcNo: textOrNull(r[1]), party: textOrNull(r[2]), cable: textOrNull(r[3]), sizeSqmm: num(r[4]), cores: num(r[5]), insulation: textOrNull(r[7]), lotNo: textOrNull(r[17]), runOrderInLot: run === null ? null : Math.round(run), supplyFrom: textOrNull(r[20]),
        armour: textOrNull(r[6]), orderDate: day(r[8]), approved: textOrNull(r[9]), conductorBalCoreKm: num(r[10]), insulationBalCoreKm: num(r[11]), layingBalKm: num(r[12]), innerBalKm: num(r[13]), armouringBalKm: num(r[14]), finishBalKm: num(r[15]), pendingFrom: textOrNull(r[16]), remarks: textOrNull(r[19]), suggestedLot: textOrNull(r[21]),
      };
    }),
    // The SFG pull sometimes repeats a line (same order, stage and item). One line per key; adding the copies would count it twice.
    lines: [
      ...new Map(
        g.lines.filter(has(0)).map((r) => {
          const l = { prodOrder: text(r[0]), fgType: textOrNull(r[5]), stage: text(r[7]), sfgCode: text(r[8]), sfgItem: text(r[9]), netQty: num(r[10]) ?? 0, doneQty: num(r[11]) ?? 0, balance: num(r[12]) ?? 0, scope: textOrNull(r[14]), sfgBom: textOrNull(r[15]), fgItemCode: textOrNull(r[13]), contractNo: textOrNull(r[16]) };
          return [`${l.prodOrder}|${l.stage}|${l.sfgCode}`, l] as const;
        }),
      ).values(),
    ],
    sfgOrders: [
      ...new Map(
        g.lines.filter(has(0)).map((r) => [text(r[0]), { prodOrder: text(r[0]), mcNo: textOrNull(r[1]), orderDate: day(r[2]), party: textOrNull(r[3]), fgItem: textOrNull(r[4]), approved: textOrNull(r[6]) }] as const),
      ).values(),
    ],
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

/**
 * Replaces each table whole and logs the sync. Once the dashboard is the Club & Run master, lots and orders are
 * not replaced: SFG refreshes their balances and adds new orders, and the sheet is only compared against them.
 * Returns the tables to plan from: lots and orders come from the dashboard once it is the master.
 */
export async function storeSources(db: PrismaClient, t: Tables, s8PulledAt: string): Promise<Tables> {
  const master = (await db.setting.findUnique({ where: { key: CLUB_MASTER } }))?.value === "dashboard";
  return db.$transaction(
    async (tx) => {
      if (master) {
        const value = { at: new Date().toISOString(), diffs: compareSheet(t, { lots: await tx.kgpLot.findMany(), orders: await tx.kgpOrder.findMany() }) };
        await tx.setting.upsert({ where: { key: CLUB_COMPARE }, create: { key: CLUB_COMPARE, value, updatedBy: "sync" }, update: { value, updatedBy: "sync" } });
      } else {
        await tx.kgpLot.deleteMany();
        await tx.kgpOrder.deleteMany();
      }
      await tx.kgpOrderLine.deleteMany();
      await tx.bomLine.deleteMany();
      await tx.rmStock.deleteMany();
      await tx.machineMen.deleteMany();
      await tx.raccoonDrum.deleteMany();
      if (master) await refreshClub(tx, t.lines, t.sfgOrders);
      else {
        await tx.kgpLot.createMany({ data: t.lots });
        await tx.kgpOrder.createMany({ data: t.orders });
      }
      await tx.kgpOrderLine.createMany({ data: t.lines });
      await tx.bomLine.createMany({ data: t.bom });
      await tx.rmStock.createMany({ data: t.rm });
      await tx.machineMen.createMany({ data: t.men });
      await tx.raccoonDrum.createMany({ data: t.drums });
      const log = (source: string, tab: string, rows: number) => ({ source, tab, rows, ok: true, s8PulledAt });
      await tx.syncRun.createMany({
        data: [log("S1", "Lots", t.lots.length), log("S1", "Orders", t.orders.length), log("S8", "Order lines", t.lines.length), log("S8", "Material per item", t.bom.length), log("S3", "Opening Stock", t.rm.length), log("S4", "Machines", t.men.length), log("RM", "RAW MATERIALS REQUIREMENT", t.drums.length)],
      });
      if (!master) return t;
      const lots = (await tx.kgpLot.findMany()).map((l) => ({ ...l, sentToPlant: l.sentToPlant ?? false }));
      return { ...t, lots, orders: await tx.kgpOrder.findMany() };
    },
    { timeout: 60_000, maxWait: 20_000 }, // maxWait: a suspended Neon database takes several seconds to wake
  );
}
