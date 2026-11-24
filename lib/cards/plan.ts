// STEP 1 of Card 1: the plan (docs/final guide for card 1.md, section 4). Pure: tables in, Card plan rows out.
import { addDays, dMon } from "./calendar.ts";
import { EXT51_ORDERS, MACHINES, type MachineName } from "./machines.ts";
import type { Day, PlanRow } from "./sheet.ts";
import type { Tables } from "./sources.ts";

const EPS = 0.005;
type Line = Tables["lines"][number];
type Piece = { qty: number; machine: string | null; day: number };

/** Stock as a first-in-first-out list of pieces. What is made today is `incoming` until the day ends (guide 4.3, 4.4). */
class Stock {
  pieces: Piece[] = [];
  incoming = 0;
  readonly opening: number;
  constructor(opening: number) {
    this.opening = Math.max(0, opening);
    if (this.opening > 0) this.pieces.push({ qty: this.opening, machine: null, day: -1 });
  }
  get now() {
    return this.pieces.reduce((s, p) => s + p.qty, 0);
  }
  get all() {
    return this.now + this.incoming;
  }
  take(q: number): Piece[] {
    const used: Piece[] = [];
    while (q > 1e-9 && this.pieces.length) {
      const p = this.pieces[0];
      const part = Math.min(p.qty, q);
      used.push({ ...p, qty: part });
      p.qty -= part;
      q -= part;
      if (p.qty <= 1e-9) this.pieces.shift();
    }
    return used;
  }
}

type Item = { line: Line; size: number; bal: number };
type Ord = {
  o: Tables["orders"][number];
  lotRank: number;
  kind: "cable" | "ht" | "acsr" | "cc";
  big: boolean;
  cores: number;
  cond: Item[];
  ins: Item[];
  laying?: Item;
  inner?: Item;
  arm?: Item;
  finish?: Item;
  /** Conductor stock by size (sq mm). */
  condStock: Map<number, Stock>;
  /** Insulated-core stock and core km per cable km, by SFG code. */
  insStock: Map<string, Stock>;
  share: Map<string, number>;
  laid: Stock;
  innerS: Stock;
  armoured: Stock;
  /** Covered conductor: first-pass and final-pass conductor, and what each pass has left to make. */
  first: Stock;
  final: Stock;
  firstBal: number;
  finalBal: number;
};

/** Keeps a machine on one compound or armour size: which key ran last and how long each other key has waited. */
type Campaign = { current: string | null; waited: Map<string, number> };

/** Keys in the order to run today. `work` = days of work per key, in lot order. */
function campaignOrder(c: Campaign, work: Map<string, number>, keep: number, maxWait: number): string[] {
  const keys = [...work.keys()];
  const first = keys.find((k) => (c.waited.get(k) ?? 0) >= maxWait) ?? (c.current !== null && (work.get(c.current) ?? 0) >= keep ? c.current : keys[0]);
  return first === undefined ? [] : [first, ...keys.filter((k) => k !== first)];
}
function campaignEnd(c: Campaign, work: Map<string, number>, ran: string[]) {
  c.waited = new Map([...work.keys()].map((k) => [k, ran.includes(k) ? 0 : (c.waited.get(k) ?? 0) + 1]));
  if (ran.length) c.current = ran[ran.length - 1];
}

const sizeOf = (sfgItem: string) => Number(/\d+(\.\d+)?/.exec(sfgItem)?.[0] ?? NaN);
/** Power cable conductor. 16, 50 and 95 sq mm: machine to confirm (null), so they go to the to-confirm list. 19-wire 70 never on Skip 10. */
const condMachine = (size: number): MachineName | null =>
  size > 300 ? "MS-11" : size >= 150 ? "MS-14" : size === 70 ? "Skip (12+7)-1" : size === 25 || size === 35 ? "Skip 8" : null;
/** Conductor for Sioplas (HT): 300 sq mm and above on MS-11, below 300 (185) on MS-14. */
const htMachine = (size: number): MachineName => (size >= 300 ? "MS-11" : "MS-14");
/** Laying 5 km a day: 300 sq mm 3, other 7. */
const layRate = (size: number) => (size === 300 ? 3 : 7);
/** Insulated core on one drum (~24 drums in all): 300 sq mm about 1 km, small cable 4–5 km. */
const INS_DRUMS = 24;
const insKmPerDrum = (size: number, big: boolean) => (size >= 300 || big ? 1 : 4.5);
const insMachine = (size: number): MachineName => (size <= 70 ? "Extruder 35" : "Extruder 22");
const COND_RATE: Partial<Record<MachineName, number>> = { "Skip (12+7)-1": 10, "Skip (12+7)-2": 11, "Skip 8": 25, "MS-14": 12.6, "MS-11": 12 };
/** kg of compound a day (guide 3.3). */
const TONNAGE: Partial<Record<MachineName, Record<string, number>>> = {
  "Extruder 22": { XLPE: 3500, PVC: 5500 },
  "Extruder 35": { XLPE: 2500, PVC: 3500 },
  "Extruder 51": { PVC: 6000 },
  "Extruder 52": { PVC: 7500, HDPE: 5500 },
};
const WIRE_FEED = "Aluminium wire drawn on WD14";
/** Job-text tail of a small-cable sheathing job on Extruder 52; the production card colours these lines. */
export const ASK_E51 = "may go to Extruder 51?";

export function planCard1(t: Tables, d0: Day): { rows: PlanRow[]; notPlanned: string[] } {
  const bomBy = Map.groupBy(t.bom, (b) => b.sfgBom);
  const linesBy = Map.groupBy(t.lines, (l) => l.prodOrder);
  const lotBy = new Map(t.lots.filter((l) => l.approvedByMd && l.sentToPlant !== false).map((l) => [l.lotNo, l]));
  const notPlanned: string[] = [];
  const firstWord = (s: string | null) => (s ?? "").trim().split(/\s+/)[0];

  // ── 4.1 what is planned, 4.2 opening stock ──
  const orders: Ord[] = t.orders
    .filter((o) => o.lotNo && lotBy.has(o.lotNo) && !/ABJ/i.test(o.party ?? "") && !/(dead|old|free)\s*stock/i.test(o.supplyFrom ?? ""))
    .sort((a, b) => lotBy.get(a.lotNo!)!.runOrder - lotBy.get(b.lotNo!)!.runOrder || (a.runOrderInLot ?? 1e9) - (b.runOrderInLot ?? 1e9) || a.prodOrder.localeCompare(b.prodOrder))
    .flatMap((o): Ord[] => {
      // No row in Order lines = no balance left at Kharagpur: skipped silently.
      const lines = linesBy.get(o.prodOrder);
      if (!lines) return [];
      const words = `${o.cable ?? ""} ${lines.map((l) => `${l.sfgItem} ${l.fgType ?? ""}`).join(" ")}`;
      const kind = lines.some((l) => l.scope === "Core for Poly Park (P1)") ? "ht" : /COVERED CONDUCTOR/i.test(words) ? "cc" : /ACSR/i.test(words) ? "acsr" : "cable";
      const items = (stage: string): Item[] => lines.filter((l) => l.stage === stage).map((line) => ({ line, size: sizeOf(line.sfgItem), bal: Math.max(0, line.balance) }));
      // HT orders: only CONDUCTOR and INSULATION are made at Kharagpur. All their other stages are ignored.
      const later = (stage: string) => (kind === "cable" ? items(stage)[0] : undefined);
      const [cond, ins, laying, inner, arm, finish] = [items("CONDUCTOR"), items("INSULATION"), later("LAYING"), later("INNER"), later("ARMOURING"), later("FINISH")];
      const done = (list: Item[]) => list.reduce((s, i) => s + i.line.doneQty, 0);
      const between = (a?: Item, b?: Item) => new Stock(a && b ? a.line.doneQty - b.line.doneQty : 0);
      const share = new Map(ins.map((i) => [i.line.sfgCode, laying && laying.line.netQty > 0 ? i.line.netQty / laying.line.netQty : 0]));
      const fgType = lines[0].fgType ?? "";
      if (kind === "cable" && !/BIG|SMALL/i.test(fgType)) notPlanned.push(`${o.prodOrder} (${firstWord(o.party)}): FG type "${fgType}" is neither BIG nor SMALL – planned at big-cable rates`);
      const condBal = cond.reduce((s, i) => s + i.bal, 0);
      return [{
        o, kind, cond, ins, laying, inner, arm, finish, share,
        lotRank: lotBy.get(o.lotNo!)!.runOrder,
        big: !/SMALL/i.test(fgType),
        cores: o.cores ?? ([...share.values()].reduce((s, x) => s + x, 0) || 1),
        // Conductor and insulation items are matched by size.
        condStock: new Map([...new Set(cond.map((i) => i.size))].map((s) => [s, new Stock(kind === "cc" ? 0 : done(cond.filter((i) => i.size === s)) - done(ins.filter((i) => i.size === s)))])),
        insStock: new Map(ins.map((i) => [i.line.sfgCode, new Stock(i.line.doneQty - (laying?.line.doneQty ?? 0) * share.get(i.line.sfgCode)!)])),
        laid: between(laying, inner),
        innerS: between(inner, arm),
        armoured: between(arm, finish),
        first: new Stock(0),
        final: new Stock(kind === "cc" ? done(cond) - done(ins) : 0),
        firstBal: condBal,
        finalBal: condBal,
      }];
    });

  /** Covered conductor of 100 sq mm (or less) runs on MS-18 only, without a first pass. */
  const ccDirect = (x: Ord) => (x.cond[0]?.size ?? Infinity) <= 100;
  const of = (kind: Ord["kind"]) => orders.filter((x) => x.kind === kind);
  const [cables, hts, acsrs, ccs] = [of("cable"), of("ht"), of("acsr"), of("cc")];
  for (const x of cables) for (const it of x.cond) if (it.bal > EPS && !condMachine(it.size)) notPlanned.push(`${x.o.prodOrder} (${firstWord(x.o.party)}): ${it.size} sq mm conductor, ${+it.bal.toFixed(2)} core km – machine to confirm`);
  if (cables.some((x) => x.big && x.ins.some((i) => i.bal > EPS && i.size < 300)))
    notPlanned.push("Insulated core per drum for big cable below 300 sq mm: taken as 1 km (as for 300 sq mm) – to confirm");

  // ── text on the rows (4.4, 4.5) ──
  const partyCable = (x: Ord) => {
    const o = x.o;
    if (x.kind === "cc" || x.kind === "acsr" || o.cores === null || o.sizeSqmm === null) return `${firstWord(o.party)} · ${o.cable ?? ""}`;
    const armour = /STRIP/i.test(o.cable ?? "") ? "strip " : /WIRE/i.test(o.cable ?? "") ? "wire " : "";
    return `${firstWord(o.party)} · ${o.cores}C×${o.sizeSqmm} Al ${armour}${o.insulation ?? ""}`.trim();
  };
  /** "300 sq mm – FULL core"; HALF = the smaller size of a 3.5C cable. */
  const sizeCore = (x: Ord, it: Item) => {
    const sizes = [...new Set((x.ins.length ? x.ins : x.cond).map((i) => i.size))];
    return `${it.size} sq mm – ${sizes.length > 1 && it.size === Math.min(...sizes) ? "HALF" : "FULL"} core`;
  };
  const material = (line: Line, q: number) =>
    (bomBy.get(line.sfgBom ?? "") ?? []).toSorted((a, b) => a.lineNo - b.lineNo).map((b) => `${b.material} ${Math.round(q * b.kgPerKm).toLocaleString("en-US")} kg`).join(" · ");
  /** Compound of an extruder job, from the BOM: the heaviest XLPE / PVC / HDPE line, and its kg per km. */
  const compound = (x: Ord, line: Line) => {
    const hits = (bomBy.get(line.sfgBom ?? "") ?? []).flatMap((b) => {
      const name = /XLPE|PVC|HDPE/i.exec(b.material)?.[0].toUpperCase();
      return name ? [{ name, kg: b.kgPerKm }] : [];
    });
    const name = hits.toSorted((a, b) => b.kg - a.kg)[0]?.name ?? /XLPE|PVC|HDPE/i.exec(x.o.insulation ?? "")?.[0].toUpperCase() ?? "Compound ⚠ to confirm";
    return { name, kg: hits.filter((h) => h.name === name).reduce((s, h) => s + h.kg, 0) };
  };
  /** "Strip 4×0.80" from "STEEL STRIP 4*0.80 MM (IS)" in the BOM of the armouring item. */
  const armour = (x: Ord) => {
    const m = (bomBy.get(x.arm!.line.sfgBom ?? "") ?? []).map((b) => /STEEL (STRIP|WIRE)\s+([\d.]+(?:\s*[*xX×]\s*[\d.]+)?)/i.exec(b.material)).find(Boolean);
    return m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2].replace(/\s*[*xX×]\s*/, "×")}` : "Armour ⚠ size to confirm";
  };
  const date = (d: number) => dMon(addDays(d0, d));
  const feed = (what: string, stock: Stock, used: Piece[], unit: string) => {
    const made = used.filter((p) => p.machine !== null);
    if (!made.length) return `${what}: ready in stock (${+stock.opening.toFixed(2)} ${unit})`;
    const [a, b] = [Math.min(...made.map((p) => p.day)), Math.max(...made.map((p) => p.day))];
    return `${what}: from ${[...new Set(made.map((p) => p.machine))].join(" and ")} on ${date(a)}${b > a ? `–${date(b)}` : ""}`;
  };

  const rows: PlanRow[] = [];
  const insCampaign: Partial<Record<MachineName, Campaign>> = {};
  const sheathCampaign: Partial<Record<MachineName, Campaign>> = {};
  const armCampaign: Campaign = { current: null, waited: new Map() };
  let lastArmour: string | null = null;
  const sum = <T>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);
  const stocks = (m: Map<unknown, Stock>) => sum([...m.values()], (s) => s.all);

  // ── 4.3 day simulation: all 70 days are kept. Card 1 prints the first 15; Card 3 needs outer-sheath dates past them. ──
  for (let d = 0; d < 70; d++) {
    const used = new Map<string, number>();
    const left = (m: MachineName) => 1 - (used.get(m) ?? 0);
    const kgUsed = new Map<string, number>();
    const made: [Stock, Piece][] = [];
    const layBalBefore = (x: Ord) => sum(cables.filter((y) => y.lotRank < x.lotRank), (y) => y.laying?.bal ?? 0);
    /** One job line. `into` = the stock the output joins tomorrow. */
    const job = (m: MachineName, x: Ord, q: number, rate: number, unit: string, r: { line?: Line; core?: string; feed: string; job: string; status?: "ok" | "drum"; into?: Stock }) => {
      used.set(m, (used.get(m) ?? 0) + q / rate);
      if (r.into) {
        r.into.incoming += q;
        made.push([r.into, { qty: q, machine: m, day: d }]);
      }
      rows.push({
        version: "", rowNo: rows.length + 1, day: addDays(d0, d), process: MACHINES[m].group, machine: m,
        prodOrder: x.o.prodOrder, mc: x.o.mcNo ?? "", partyCable: partyCable(x), lot: x.o.lotNo ?? "",
        qty: +q.toFixed(2), unit, sizeCore: r.core ?? "–", material: r.line ? material(r.line, q) : "", feed: r.feed, feedStatus: r.status ?? "ok", job: r.job,
      });
    };
    /** Room under a compound's daily tonnage, in km of this item. */
    const tonRoom = (m: MachineName, c: { name: string; kg: number }) => {
      const limit = TONNAGE[m]?.[c.name];
      return limit === undefined || c.kg <= 0 ? Infinity : (limit - (kgUsed.get(`${m}|${c.name}`) ?? 0)) / c.kg;
    };
    const tonUse = (m: MachineName, c: { name: string; kg: number }, q: number) => kgUsed.set(`${m}|${c.name}`, (kgUsed.get(`${m}|${c.name}`) ?? 0) + q * c.kg);

    // 1. Cable conductor. On Skip (12+7)-1 any 70 sq mm left over runs first.
    const condJobs = cables.flatMap((x) => x.cond.map((it) => ({ x, it, m: condMachine(it.size) })));
    for (const { x, it, m } of condJobs.toSorted((a, b) => Number(b.it.size === 70) - Number(a.it.size === 70))) {
      if (!m || it.bal <= EPS || layBalBefore(x) > 40) continue;
      const im = insMachine(it.size);
      const feedLimit = im === "Extruder 35" ? 30 : it.size >= 150 ? 32 : 45;
      const waiting = sum(cables, (y) => sum([...y.condStock], ([size, s]) => (insMachine(size) === im ? s.all : 0)));
      const room = Math.min(feedLimit - waiting, x.cores * (x.big ? 6 : 9) - stocks(x.condStock));
      const q = Math.min(it.bal, left(m) * COND_RATE[m]!, room);
      if (q < 0.05) continue;
      it.bal -= q;
      job(m, x, q, COND_RATE[m]!, "core km", { line: it.line, core: sizeCore(x, it), feed: WIRE_FEED, job: "Conductor", into: x.condStock.get(it.size) });
    }

    // 2. ACSR Raccoon on Skip 10, wound on FG drums: from day 3 the drums must be assembled the day before.
    for (const x of acsrs) for (const it of x.cond) {
      const q = Math.min(it.bal, left("Skip 10") * 23);
      if (q <= EPS) continue;
      it.bal -= q;
      job("Skip 10", x, q, 23, "km", { line: it.line, feed: "Aluminium wire drawn on WD17", job: "ACSR Raccoon", status: d <= 2 ? "ok" : "drum" });
    }

    // 3. HT conductor: 300 sq mm and above on MS-11, below on MS-14; HT conductor stock kept to 27 core km.
    for (const x of hts) for (const it of x.cond) {
      const m = htMachine(it.size);
      const q = Math.min(it.bal, left(m) * COND_RATE[m]!, 27 - sum(hts, (y) => stocks(y.condStock)));
      if (q <= EPS) continue;
      it.bal -= q;
      job(m, x, q, COND_RATE[m]!, "core km", { line: it.line, core: sizeCore(x, it), feed: WIRE_FEED, job: "HT conductor", into: x.condStock.get(it.size) });
    }

    // 4. Covered conductor, only when HT insulation still to do ≤ 27 core km. 100 sq mm runs on MS-18 only;
    //    above 100, a first pass on Skip 11 then the final pass on MS-18. The rod is counted on the first machine.
    if (sum(hts, (x) => sum(x.ins, (i) => i.bal)) <= 27) {
      for (const x of ccs.filter((y) => !ccDirect(y))) {
        const q = Math.min(x.firstBal, left("Skip 11") * 31.9, 30 - sum(ccs, (y) => y.first.all));
        if (q <= EPS) continue;
        x.firstBal -= q;
        job("Skip 11", x, q, 31.9, "km", { line: x.cond[0].line, feed: WIRE_FEED, job: "Covered conductor – first pass", into: x.first });
      }
      for (const x of ccs) {
        const direct = ccDirect(x);
        const q = Math.min(x.finalBal, left("MS-18") * 14.1, direct ? Infinity : x.first.now, 46 - sum(ccs, (y) => y.final.all));
        if (q <= EPS) continue;
        x.finalBal -= q;
        job("MS-18", x, q, 14.1, "km", direct
          ? { line: x.cond[0].line, feed: WIRE_FEED, job: "Covered conductor", into: x.final }
          : { feed: feed("First-pass conductor", x.first, x.first.take(q), "km"), job: "Covered conductor – final pass", into: x.final });
      }
    }

    // 5. Sioplas 4: HT first, then covered conductor.
    for (const x of hts) for (const it of x.ins) {
      const stock = x.condStock.get(it.size);
      const q = Math.min(it.bal, left("Sioplas 4") * 9, stock?.now ?? 0);
      if (q <= EPS) continue;
      it.bal -= q;
      job("Sioplas 4", x, q, 9, "core km", { line: it.line, core: sizeCore(x, it), feed: feed("Conductor", stock!, stock!.take(q), "core km"), job: "HT insulation" });
    }
    for (const x of ccs) for (const it of x.ins) {
      const q = Math.min(it.bal, left("Sioplas 4") * 23, x.final.now);
      if (q <= EPS) continue;
      it.bal -= q;
      job("Sioplas 4", x, q, 23, "km", { line: it.line, feed: feed("Final-pass conductor", x.final, x.final.take(q), "km"), job: "Covered conductor insulation" });
    }

    // 6. Insulation, in lot order: insulated core waits on drums (about 24 in all) and is made at most one day
    //    ahead of laying, so each order's insulated stock stays within one day of Laying 5 for that order.
    for (const m of ["Extruder 22", "Extruder 35"] as const) {
      const rate = (size: number) => (m === "Extruder 35" ? 12 : size >= 150 ? 16 : size >= 95 ? 24 : 30);
      const drumsInUse = () => sum(cables, (y) => sum(y.ins, (i) => y.insStock.get(i.line.sfgCode)!.all / insKmPerDrum(i.size, y.big)));
      const oneDay = (x: Ord, it: Item) => layRate(x.o.sizeSqmm ?? it.size) * x.share.get(it.line.sfgCode)! - x.insStock.get(it.line.sfgCode)!.all;
      const eligible = (x: Ord, it: Item) => Math.min(it.bal, x.condStock.get(it.size)?.now ?? 0, oneDay(x, it));
      const todo = cables.flatMap((x) => x.ins.filter((it) => insMachine(it.size) === m && eligible(x, it) > EPS).map((it) => ({ x, it, c: compound(x, it.line) })));
      const work = new Map<string, number>();
      for (const { x, it, c } of todo) work.set(c.name, (work.get(c.name) ?? 0) + eligible(x, it) / rate(it.size));
      const campaign = (insCampaign[m] ??= { current: null, waited: new Map() });
      const ran: string[] = [];
      for (const name of campaignOrder(campaign, work, 0.5, 4)) for (const { x, it, c } of todo.filter((j) => j.c.name === name)) {
        const drumRoom = (INS_DRUMS - drumsInUse()) * insKmPerDrum(it.size, x.big);
        const q = Math.min(eligible(x, it), left(m) * rate(it.size), drumRoom, tonRoom(m, c));
        if (q <= EPS) continue;
        it.bal -= q;
        tonUse(m, c, q);
        if (!ran.includes(name)) ran.push(name);
        const stock = x.condStock.get(it.size)!;
        job(m, x, q, rate(it.size), "core km", { line: it.line, core: sizeCore(x, it), feed: feed("Conductor", stock, stock.take(q), "core km"), job: c.name, into: x.insStock.get(it.line.sfgCode) });
      }
      campaignEnd(campaign, work, ran);
    }

    // 7. Laying 5: laid + inner-sheathed stock of all orders is held to 22 km, so laying keeps pace with Armouring 5 (the bottleneck).
    for (const x of cables) {
      const lay = x.laying;
      if (!lay || lay.bal <= EPS) continue;
      const cores = x.ins.filter((i) => x.share.get(i.line.sfgCode)! > 0);
      const can = cores.length ? Math.min(...cores.map((i) => x.insStock.get(i.line.sfgCode)!.now / x.share.get(i.line.sfgCode)!)) : 0;
      const rate = layRate(x.o.sizeSqmm ?? Math.max(...x.ins.map((i) => i.size)));
      const q = Math.min(lay.bal, can, left("Laying 5") * rate, 22 - sum(cables, (y) => y.laid.all + y.innerS.all));
      if (q <= EPS) continue;
      lay.bal -= q;
      const two = new Set(cores.map((i) => i.size)).size > 1;
      const small = Math.min(...cores.map((i) => i.size));
      const feeds = cores.map((i) => {
        const stock = x.insStock.get(i.line.sfgCode)!;
        return feed(`Insulated core${two ? (i.size === small ? " (half core)" : " (full core)") : ""}`, stock, stock.take(q * x.share.get(i.line.sfgCode)!), "core km");
      });
      job("Laying 5", x, q, rate, "km", { line: lay.line, feed: feeds.join(" · "), job: "Laying", into: x.laid });
    }

    // 8. Sheathing: a) inner sheath until total inner stock = 9 km, b) outer sheath of all armoured stock, c) more inner up to 16 km.
    for (const m of ["Extruder 51", "Extruder 52"] as const) {
      const mine = cables.filter((x) => EXT51_ORDERS.includes(Number(x.o.prodOrder.split("-").pop())) === (m === "Extruder 51"));
      const rate = (x: Ord, outer: boolean) => (m === "Extruder 51" ? (outer ? 13 : 12) : outer ? (x.big ? 8 : 13) : x.big ? 9 : 12);
      const inners = mine.filter((x) => x.inner && x.inner.bal > EPS && x.laid.now > EPS).map((x) => ({ x, it: x.inner!, from: x.laid, outer: false, c: compound(x, x.inner!.line) }));
      const outers = mine.filter((x) => x.finish && x.finish.bal > EPS && x.armoured.now > EPS).map((x) => ({ x, it: x.finish!, from: x.armoured, outer: true, c: compound(x, x.finish!.line) }));
      const work = new Map<string, number>();
      for (const j of [...inners, ...outers]) work.set(j.c.name, (work.get(j.c.name) ?? 0) + Math.min(j.it.bal, j.from.now) / rate(j.x, j.outer));
      const campaign = (sheathCampaign[m] ??= { current: null, waited: new Map() });
      const names = campaignOrder(campaign, work, 0.6, 4);
      const ran: string[] = [];
      for (const [jobs, target] of [[inners, 9], [outers, Infinity], [inners, 16]] as const) for (const name of names) for (const { x, it, from, outer, c } of jobs.filter((j) => j.c.name === name)) {
        const q = Math.min(it.bal, from.now, left(m) * rate(x, outer), target - sum(cables, (y) => y.innerS.all), tonRoom(m, c));
        if (q <= EPS) continue;
        it.bal -= q;
        tonUse(m, c, q);
        if (!ran.includes(name)) ran.push(name);
        // Small cable (up to 4C × 25) on Extruder 52: the card asks the plant whether it may go to Extruder 51.
        const ask51 = m === "Extruder 52" && (x.o.cores ?? Infinity) <= 4 && (x.o.sizeSqmm ?? Infinity) <= 25 ? ` – ${ASK_E51}` : "";
        job(m, x, q, rate(x, outer), "km", outer
          ? { line: it.line, core: "OUTER sheath", feed: feed("Armoured cable", from, from.take(q), "km"), job: `Outer sheath${ask51}` }
          : { line: it.line, core: "INNER sheath", feed: feed("Laid cable", from, from.take(q), "km"), job: `Inner sheath${ask51}`, into: x.innerS });
      }
      campaignEnd(campaign, work, ran);
    }

    // 9. Armouring 5: orders with inner-sheathed stock from earlier days, kept on one armour size.
    {
      const todo = cables.filter((x) => x.arm && x.arm.bal > EPS && x.innerS.now > EPS).map((x) => ({ x, key: armour(x), rate: x.big ? 7 : 10 }));
      const work = new Map<string, number>();
      for (const j of todo) work.set(j.key, (work.get(j.key) ?? 0) + Math.min(j.x.arm!.bal, j.x.innerS.now) / j.rate);
      const ran: string[] = [];
      for (const key of campaignOrder(armCampaign, work, 0.4, 5)) for (const { x, rate } of todo.filter((j) => j.key === key)) {
        const q = Math.min(x.innerS.now, x.arm!.bal, left("Armouring 5") * rate);
        if (q <= EPS) continue;
        x.arm!.bal -= q;
        if (!ran.includes(key)) ran.push(key);
        const change = lastArmour !== null && lastArmour !== key ? ` – ${key.split(" ")[0].toLowerCase()} change` : "";
        lastArmour = key;
        job("Armouring 5", x, q, rate, "km", { line: x.arm!.line, feed: feed("Inner-sheathed cable", x.innerS, x.innerS.take(q), "km"), job: key + change, into: x.armoured });
      }
      campaignEnd(armCampaign, work, ran);
    }

    // 10. The day's production joins the stock: usable from the next day.
    for (const [stock, piece] of made) {
      stock.pieces.push(piece);
      stock.incoming = 0;
    }
  }
  return { rows, notPlanned };
}
