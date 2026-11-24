// Club & Run planning view (plan of 23-Nov, Parts 1.4, 3 and 4): what each order is made of, the lot checks of
// rules CR-E-21..29, expected finish dates from the latest production cards, the traffic-jam check and the
// "what if" delay. Pure functions: the pages load the rows and pass them in.

type Day = string; // YYYY-MM-DD

export type OrderIn = {
  prodOrder: string; party: string | null; cable: string | null; lotNo: string | null; runOrderInLot: number | null; supplyFrom: string | null;
  finishBalKm: number | null; armouringBalKm: number | null; conductorBalCoreKm: number | null; pendingFrom: string | null;
  onHold: boolean; urgent: boolean; customerDate: Date | null; promisedOn: Date | null; addedAt: Date | null; remarks: string | null;
};
export type LotIn = { lotNo: string; runOrder: number; approvedByMd: boolean; sentToPlant: boolean | null; status: string | null; whatClubbed: string | null };
export type LineIn = { prodOrder: string; fgType: string | null; stage: string; sfgItem: string; netQty: number; doneQty: number; balance: number; sfgBom: string | null };
export type PlanIn = { day: Day; machine: string; process: string; prodOrder: string; lot: string; qty: number; unit: string; sizeCore: string; feed: string; feedStatus: string; job: string };

/** Armouring 5, the bottleneck, km a day for big cable (plan 1.4 and 3.6). */
export const ARMOUR_KM_DAY = 7;
/** Skip 10 makes ACSR / AAAC about this many km a day (production card rate). */
const STRAND_KM_DAY = 23;
/** Lot size limit, CR-E-29: cable about 80 km, ACSR / AAAC up to 500 km. */
export const LOT_KM = { cable: 80, strand: 500 };
/** Orders of this many km or less: ask first whether dead stock or the market can supply (CR-F-36). */
export const SMALL_KM = 2;
// shortcut: "jam" = more than 3 days of work already waiting at the next machine; the MD has not given a figure (CR-H-42 "to confirm").
export const JAM_DAYS = 3;
/** Stage rates in cable km a day, used for the jam check only (production card rates, big cable). */
const STAGE_RATE: Record<string, { machine: string; rate: number }> = {
  LAYING: { machine: "Laying 5", rate: 7 },
  INNER: { machine: "Extruder 52 (inner)", rate: 9 },
  ARMOURING: { machine: "Armouring 5", rate: ARMOUR_KM_DAY },
  FINISH: { machine: "Extruder 52 (outer)", rate: 8 },
};
const CABLE_STAGES = ["CONDUCTOR", "INSULATION", "LAYING", "INNER", "ARMOURING", "FINISH"] as const;
type Stage = (typeof CABLE_STAGES)[number];

const EPS = 1e-6;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const addDays = (d: Day, n: number): Day => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
export const dayOf = (d: Date | null): Day | null => (d ? d.toISOString().slice(0, 10) : null);
export const daysBetween = (a: Day, b: Day) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

// ── Order profile ───────────────────────────────────────────────────────────

export type Product = "Cable" | "HT core" | "ACSR" | "AAAC" | "Covered conductor";
export type Profile = {
  prodOrder: string;
  product: Product;
  /** Small / big cable, from the SFG FG type (FG_LEVEL_4_NAME). */
  category: "BIG" | "SMALL" | "HT" | "OTHER";
  conductorSize: number | null;
  conductorType: string | null;
  insulation: string | null;
  /** Armour material from the ERP BOM of the armouring line; null for an unarmoured product. */
  armour: string | null;
  armoured: boolean;
  /** Order length in km: finished cable km, or conductor km for ACSR / AAAC. */
  km: number;
  /** Still to make at Kharagpur, in the same unit. */
  leftKm: number;
  conductorStarted: boolean;
  anyDone: boolean;
  /** Per stage: made and ordered, from SFG. */
  stages: Partial<Record<Stage, { done: number; net: number }>>;
  /** The stage still to finish first; "Done" when nothing is left at Kharagpur. */
  pending: string;
};

const sizeIn = (s: string) => {
  const m = /(\d+(?:\.\d+)?)\s*SQ/i.exec(s);
  return m ? Number(m[1]) : null;
};
const typeIn = (s: string) => /ACSR/i.test(s) ? "ACSR" : /AAAC|AL-59/i.test(s) ? "AAAC" : /COVERED/i.test(s) ? "COVERED" : /SHAPED/i.test(s) ? "SHAPED" : /COMPACT/i.test(s) ? "COMPACT" : /ROUND/i.test(s) ? "ROUND" : null;

/** What each order is, from its SFG lines and the armour material of its BOM. */
export function profileOf(prodOrder: string, lines: LineIn[], armourOf: Map<string, string>, fallbackKm = 0): Profile {
  const mine = lines.filter((l) => l.prodOrder === prodOrder);
  const fg = mine.find((l) => l.fgType)?.fgType ?? "";
  const cond = mine.filter((l) => l.stage === "CONDUCTOR").sort((a, b) => b.netQty - a.netQty);
  const condText = cond[0]?.sfgItem ?? "";
  const finish = mine.filter((l) => l.stage === "FINISH");
  const arm = mine.find((l) => l.stage === "ARMOURING");
  const ins = mine.find((l) => l.stage === "INSULATION")?.sfgItem ?? finish[0]?.sfgItem ?? "";
  const product: Product = /STRAND/i.test(fg) ? (/ACSR/i.test(condText) ? "ACSR" : "AAAC") : /COVERED/i.test(fg) ? "Covered conductor" : /^HT/i.test(fg) ? "HT core" : "Cable";
  const stages: Profile["stages"] = {};
  for (const s of CABLE_STAGES) {
    const ls = mine.filter((l) => l.stage === s);
    if (ls.length) stages[s] = { done: r2(sum(ls, (l) => l.doneQty)), net: r2(sum(ls, (l) => l.netQty)) };
  }
  const strand = product === "ACSR" || product === "AAAC";
  const km = strand ? sum(cond.slice(0, 1), (l) => l.netQty) : finish.length ? sum(finish, (l) => l.netQty) : fallbackKm;
  const leftKm = strand ? sum(cond.slice(0, 1), (l) => Math.max(0, l.balance)) : sum(finish, (l) => Math.max(0, l.balance));
  const firstLeft = CABLE_STAGES.find((s) => mine.some((l) => l.stage === s && l.balance > EPS));
  return {
    prodOrder,
    product,
    category: /BIG/i.test(fg) ? "BIG" : /SMALL/i.test(fg) ? "SMALL" : /^HT/i.test(fg) ? "HT" : "OTHER",
    conductorSize: sizeIn(condText),
    conductorType: typeIn(condText),
    insulation: /XLPE/i.test(ins) ? "XLPE" : /PVC/i.test(ins) ? "PVC" : null,
    armour: arm?.sfgBom ? (armourOf.get(arm.sfgBom) ?? null) : null,
    armoured: !!arm,
    km: r2(km),
    leftKm: r2(leftKm),
    conductorStarted: cond.some((l) => l.doneQty > EPS),
    anyDone: mine.some((l) => l.doneQty > EPS),
    stages,
    pending: firstLeft ? STAGE_NAME[firstLeft] : "Done",
  };
}
export const STAGE_NAME: Record<Stage, string> = { CONDUCTOR: "Conductor", INSULATION: "Insulation", LAYING: "Laying", INNER: "Inner", ARMOURING: "Armouring", FINISH: "Outer" };

// ── Lot checks (CR-E-22..29) ────────────────────────────────────────────────

export type Check = { code: string; label: string; ok: boolean; order: string; lot: string; /** false: shown, never stops the lot (CR-E-28 "where possible") */ blocking: boolean };

const show = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "not known" : String(v));

/**
 * The check table shown to the MD before an order joins a lot (CR-E-31). `lot` holds the profiles of the orders
 * already in it; an empty lot (a new one) passes every "same as the lot" check. `running` = the lot is on a machine now.
 */
export function lotChecks(o: Profile, lot: Profile[], running: boolean): Check[] {
  // The lot is described by an order SFG still lists; a finished order has no lines left to read it from.
  const first = lot.find((p) => p.conductorSize !== null || p.armoured) ?? lot[0];
  const same = (code: string, label: string, pick: (p: Profile) => string | number | null, blocking = true): Check => {
    const mine = pick(o);
    const theirs = first ? pick(first) : null;
    return { code, label, ok: !first || (mine !== null && mine === theirs), order: show(mine), lot: first ? show(theirs) : "new lot", blocking };
  };
  // shortcut: covered conductor takes the ACSR / AAAC limit (it is AAAC-based; lot PL-022 holds 218 km); MD to confirm.
  const conductorOnly = o.product === "ACSR" || o.product === "AAAC" || o.product === "Covered conductor";
  const limit = conductorOnly ? LOT_KM.strand : LOT_KM.cable;
  const total = r2(sum(lot, (p) => p.km) + o.km);
  return [
    same("CR-E-29", "Product (cable / HT core / ACSR / AAAC / covered)", (p) => p.product),
    same("CR-E-27", "SFG category (small / big)", (p) => p.category),
    same("CR-E-23", "Conductor size (sq mm)", (p) => p.conductorSize),
    same("CR-E-24", "Armour (ERP BOM)", (p) => (p.armoured ? p.armour : "unarmoured")),
    { code: "CR-E-25", label: "Armour size confirmed in BOM", ok: !o.armoured || !!o.armour, order: o.armoured ? show(o.armour) : "unarmoured", lot: "–", blocking: true },
    same("CR-E-26", "Conductor type", (p) => p.conductorType),
    same("CR-E-28", "Insulation (XLPE / PVC)", (p) => p.insulation, false),
    { code: "CR-E-29 km", label: `Lot km (limit ${limit})`, ok: total <= limit, order: `${o.km} km`, lot: `${total} km with this order`, blocking: true },
    {
      code: "CR-E-22",
      label: "Conductor started, or a running lot makes this size",
      ok: o.conductorStarted || (running && !!first && first.conductorSize === o.conductorSize),
      order: o.conductorStarted ? "started" : "not started",
      lot: running ? "running" : "not running",
      blocking: true,
    },
  ];
}
export const failed = (cs: Check[]) => cs.filter((c) => !c.ok && c.blocking);

// ── Card timeline and expected dates ────────────────────────────────────────

/** Which stage a production-card job belongs to. */
export function stageOfJob(r: Pick<PlanIn, "process" | "machine" | "sizeCore">): Stage | "CURING" {
  if (r.process === "Armouring") return "ARMOURING";
  if (r.process === "Laying") return "LAYING";
  if (r.sizeCore === "OUTER sheath") return "FINISH";
  if (r.sizeCore === "INNER sheath") return "INNER";
  if (/Curing/i.test(r.machine)) return "CURING";
  if (/Extruder 22|Extruder 35|Sioplas/i.test(r.machine)) return "INSULATION";
  return "CONDUCTOR";
}

export type Eta = {
  prodOrder: string;
  conductorEnd: Day | null;
  armouringEnd: Day | null;
  /** Expected FG ready: the last outer-sheath day on the cards, else an estimate from the armouring rate. */
  fgReady: Day | null;
  estimated: boolean;
  /** For HT core: made at Kharagpur, finished at Poly Park. */
  note: string | null;
};

/**
 * Expected dates of every order in approved lots (and orders in no lot, at the end of the queue). An order whose
 * finishing stage is covered by the cards takes the card's last day for it. The rest queue behind the cards at the
 * bottleneck rate, in lot run order (plan 3.4: "estimated").
 */
export function expectedDates(orders: OrderIn[], lots: LotIn[], profiles: Map<string, Profile>, plan: PlanIn[], today: Day): Map<string, Eta> {
  const lotRank = new Map(lots.map((l) => [l.lotNo, l.runOrder]));
  const queue = orders
    .filter((o) => !isStock(o) && profiles.get(o.prodOrder)?.pending !== "Done")
    .sort((a, b) => (lotRank.get(a.lotNo ?? "") ?? 1e9) - (lotRank.get(b.lotNo ?? "") ?? 1e9) || (a.runOrderInLot ?? 1e9) - (b.runOrderInLot ?? 1e9));
  // The queue after the cards starts where each stream's bottleneck ends on them: Armouring 5 for cable, Skip 10 for ACSR / AAAC.
  const endOf = (m: RegExp) => plan.filter((r) => m.test(r.machine) && r.qty > 0).map((r) => r.day).sort().at(-1) ?? today;
  const streamEnd = { cable: endOf(/Armouring/), strand: endOf(/Skip 10/) };
  const backlog = { strand: 0, cable: 0 };
  const out = new Map<string, Eta>();
  for (const o of queue) {
    const p = profiles.get(o.prodOrder)!;
    const jobs = plan.filter((r) => r.prodOrder === o.prodOrder);
    const last = (s: Stage) => jobs.filter((r) => stageOfJob(r) === s).map((r) => r.day).sort().at(-1) ?? null;
    const strand = p.product === "ACSR" || p.product === "AAAC";
    const finishStage: Stage = strand || p.product === "Covered conductor" ? "CONDUCTOR" : p.product === "HT core" ? "INSULATION" : "FINISH";
    const onCards = sum(jobs.filter((r) => stageOfJob(r) === finishStage), (r) => r.qty);
    // Cable km for cable; core km cannot be compared with cable km, so for the rest the cards cover it when they plan it at all.
    const covered = finishStage === "FINISH" ? onCards > 0 && onCards >= p.leftKm - 0.01 : onCards > 0;
    let fgReady = covered ? last(finishStage) : null;
    let estimated = false;
    if (!fgReady) {
      const rate = strand ? STRAND_KM_DAY : ARMOUR_KM_DAY;
      const tail = strand ? 0 : 1; // outer sheath the day after armouring
      const rest = Math.max(0, p.leftKm - (finishStage === "FINISH" ? onCards : 0));
      if (jobs.length) {
        // Partly on the cards: the rest follows the order's own last job.
        const lastJob = jobs.map((r) => r.day).sort().at(-1)!;
        fgReady = addDays(lastJob, Math.ceil(rest / rate) + tail);
      } else {
        const k = strand ? "strand" : "cable";
        backlog[k] += rest;
        fgReady = addDays(streamEnd[k], Math.ceil(backlog[k] / rate) + tail);
      }
      estimated = true;
    }
    out.set(o.prodOrder, { prodOrder: o.prodOrder, conductorEnd: last("CONDUCTOR"), armouringEnd: last("ARMOURING"), fgReady, estimated, note: p.product === "HT core" ? "Core for Poly Park" : null });
  }
  return out;
}

export const isStock = (o: Pick<OrderIn, "supplyFrom">) => /dead|old|free/i.test(o.supplyFrom ?? "");

/** Days later lots move when `km` is added in front of them at the bottleneck (CR-E-32, plan 3.6). */
export const delayDays = (km: number, strand = false) => Math.ceil(km / (strand ? STRAND_KM_DAY : ARMOUR_KM_DAY));

// ── Lot status (plan 3.1) ───────────────────────────────────────────────────

export type LotState = "RUNNING" | "NEXT" | "QUEUED" | "WAITING" | "DONE" | "DRAFT";
export type LotView = {
  lotNo: string; runOrder: number; whatClubbed: string | null; state: LotState; reason: string | null;
  totalKm: number; leftKm: number; pctDone: number; finish: Day | null; finishEstimated: boolean;
  approved: boolean; sent: boolean;
  /** Today's job on the cards, e.g. "Armouring 5 – today 4.3 km". */
  now: string | null;
  stages: { stage: string; done: number; net: number; unit: string; start: Day | null; end: Day | null; active: string | null }[];
};

export function lotViews(lots: LotIn[], orders: OrderIn[], profiles: Map<string, Profile>, etas: Map<string, Eta>, plan: PlanIn[], today: Day): LotView[] {
  const ordered = [...lots].sort((a, b) => a.runOrder - b.runOrder);
  const views = ordered.map((l): LotView => {
    const mine = orders.filter((o) => o.lotNo === l.lotNo && !isStock(o));
    const ps = mine.map((o) => profiles.get(o.prodOrder)!).filter(Boolean);
    const jobs = plan.filter((r) => r.lot === l.lotNo);
    const todays = jobs.filter((r) => r.day === today && r.qty > 0);
    const totalKm = r2(sum(ps, (p) => p.km));
    const leftKm = r2(sum(ps, (p) => p.leftKm));
    const done = l.status === "Closed" || (ps.length > 0 && ps.every((p) => p.pending === "Done"));
    const held = jobs.filter((r) => r.day <= addDays(today, 2) && (r.feedStatus === "wait" || r.feedStatus === "drum"));
    const dates = mine.map((o) => etas.get(o.prodOrder)).filter((e): e is Eta => !!e?.fgReady);
    const finish = dates.map((e) => e.fgReady!).sort().at(-1) ?? null;
    const ht = ps.some((p) => p.product === "HT core");
    const stageList: Stage[] = ht ? ["CONDUCTOR", "INSULATION"] : ps.some((p) => p.product === "Cable") ? [...CABLE_STAGES] : ["CONDUCTOR"];
    const stages: LotView["stages"] = stageList.map((s) => {
      const sj = jobs.filter((r) => stageOfJob(r) === s);
      const today_ = sj.filter((r) => r.day === today && r.qty > 0);
      return {
        stage: ht && s === "INSULATION" ? "Sioplas" : STAGE_NAME[s],
        done: r2(sum(ps, (p) => p.stages[s]?.done ?? 0)),
        net: r2(sum(ps, (p) => p.stages[s]?.net ?? 0)),
        unit: s === "CONDUCTOR" || s === "INSULATION" ? "core km" : "km",
        start: sj.map((r) => r.day).sort()[0] ?? null,
        end: sj.map((r) => r.day).sort().at(-1) ?? null,
        active: today_.length ? `${today_[0].machine} – today ${r2(sum(today_, (r) => r.qty))} ${today_[0].unit}` : null,
      };
    });
    if (ht) stages.push({ stage: "Curing", done: 0, net: 0, unit: "", start: null, end: null, active: null }, { stage: "Poly Park", done: 0, net: 0, unit: "", start: null, end: null, active: null });
    const state: LotState = !l.approvedByMd ? "DRAFT" : done ? "DONE" : todays.length ? "RUNNING" : held.length ? "WAITING" : "QUEUED";
    const reason = state === "WAITING" ? `${held[0].machine}: ${held[0].feed}` : !l.sentToPlant && l.approvedByMd && !done ? "Not sent to plant yet" : null;
    return {
      lotNo: l.lotNo, runOrder: l.runOrder, whatClubbed: l.whatClubbed, state, reason, totalKm, leftKm,
      pctDone: totalKm > 0 ? Math.round((100 * (totalKm - leftKm)) / totalKm) : done ? 100 : 0,
      finish, finishEstimated: dates.some((e) => e.estimated), approved: l.approvedByMd, sent: !!l.sentToPlant,
      now: todays.length ? `${todays[0].machine} – today ${r2(sum(todays.filter((r) => r.machine === todays[0].machine), (r) => r.qty))} ${todays[0].unit}` : null,
      stages,
    };
  });
  // The next one or two lots in run order that are approved and not yet on a machine.
  views.filter((v) => v.state === "QUEUED").slice(0, 2).forEach((v) => (v.state = "NEXT"));
  return views;
}

// ── Traffic jam (CR-H-43..45) ───────────────────────────────────────────────

export type Jam = { stage: string; machine: string; kgpKm: number; ppKm: number; days: number; jam: boolean; text: string };

/**
 * Cable already made by the stage before and waiting at each cable stage, at Kharagpur (P726Y) and at Poly Park
 * (P126Y). Jam when Kharagpur's queue is more than JAM_DAYS of that machine's work, counting `addKm` arriving too.
 */
export function trafficJam(lines: LineIn[], addKm = 0): Jam[] {
  const waiting = (stage: Stage, prev: Stage, series: string) => {
    const orders = [...new Set(lines.filter((l) => l.prodOrder.startsWith(series)).map((l) => l.prodOrder))];
    return r2(sum(orders, (o) => {
      const d = (s: Stage) => sum(lines.filter((l) => l.prodOrder === o && l.stage === s), (l) => l.doneQty);
      const hasBoth = lines.some((l) => l.prodOrder === o && l.stage === stage) && lines.some((l) => l.prodOrder === o && l.stage === prev);
      return hasBoth ? Math.max(0, d(prev) - d(stage)) : 0;
    }));
  };
  const pairs: [Stage, Stage][] = [["INNER", "LAYING"], ["ARMOURING", "INNER"], ["FINISH", "ARMOURING"]];
  return pairs.map(([stage, prev]) => {
    const { machine, rate } = STAGE_RATE[stage];
    const kgpKm = waiting(stage, prev, "P726Y");
    const ppKm = waiting(stage, prev, "P126Y");
    const days = r2((kgpKm + addKm) / rate);
    const jam = days > JAM_DAYS;
    return { stage: STAGE_NAME[stage], machine, kgpKm, ppKm, days, jam, text: `${machine}: ${kgpKm} km waiting at KGP${addKm ? ` + ${addKm} km new` : ""} = ${days} days (Poly Park ${ppKm} km) → ${jam ? "Jam" : "OK"}` };
  });
}

// ── New-order inbox (Part 4) ────────────────────────────────────────────────

export type Suggestion = { lotNo: string; checks: Check[]; fits: boolean; fgReady: Day | null; laterDelayDays: number; later: { lotNo: string; was: Day | null; now: Day | null }[] };

/**
 * The lots an order could join, best first: lots that pass every blocking check, then by fewest failures and run
 * order. Draft and approved lots that are not finished are candidates (Part 4c).
 */
export function suggestLots(o: Profile, lots: LotView[], orders: OrderIn[], profiles: Map<string, Profile>, etas: Map<string, Eta>, top = 2): Suggestion[] {
  // A lot with no order being made is not a lot to join: that choice is "make a new lot".
  const others = orders.filter((x) => x.prodOrder !== o.prodOrder && !isStock(x));
  const own = orders.find((x) => x.prodOrder === o.prodOrder)?.lotNo;
  const open = lots.filter((l) => l.state !== "DONE" && l.lotNo !== own && others.some((x) => x.lotNo === l.lotNo));
  const strand = o.product === "ACSR" || o.product === "AAAC";
  const delay = delayDays(o.leftKm || o.km, strand);
  return open
    .map((l) => {
      const members = others.filter((x) => x.lotNo === l.lotNo).map((x) => profiles.get(x.prodOrder)!).filter(Boolean);
      const checks = lotChecks(o, members, l.state === "RUNNING");
      const later = open.filter((x) => x.runOrder > l.runOrder && x.finish).map((x) => ({ lotNo: x.lotNo, was: x.finish, now: x.finish ? addDays(x.finish, delay) : null }));
      return { s: { lotNo: l.lotNo, checks, fits: failed(checks).length === 0, fgReady: l.finish ? addDays(l.finish, delay) : null, laterDelayDays: later.length ? delay : 0, later }, runOrder: l.runOrder };
    })
    .sort((a, b) => Number(b.s.fits) - Number(a.s.fits) || failed(a.s.checks).length - failed(b.s.checks).length || a.runOrder - b.runOrder)
    .slice(0, top)
    .map((x) => x.s);
}

/** FG ready if the order starts a new lot at the end of the queue. */
export function newLotDate(o: Profile, lots: LotView[], today: Day) {
  const strand = o.product === "ACSR" || o.product === "AAAC";
  const end = lots.map((l) => l.finish).filter((d): d is Day => !!d).sort().at(-1) ?? today;
  return addDays(end, delayDays(o.leftKm || o.km, strand) + 1);
}

/** Green before the customer's date, amber up to 5 days late, red later (plan 3.4). */
export function lateness(fgReady: Day | null, customer: Day | null): { days: number | null; tone: "ok" | "warn" | "late" | null } {
  if (!fgReady || !customer) return { days: null, tone: null };
  const days = daysBetween(customer, fgReady);
  return { days, tone: days <= 0 ? "ok" : days <= 5 ? "warn" : "late" };
}
