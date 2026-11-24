// Cards 3 and 4, finished-goods drums: figures from the FG drum need, Drum assembly and Drum stock rows
// (Card 3 guide v4 and Card 4 guide v1, sections 4.2 and 4.3, with the drum size source update of 24-Nov-26).
import { addDays, ddMonYy, dMon, weeks, type CalCell } from "./calendar.ts";
import { codeOf, type Day, type DrumAssemblyRow, type DrumNeedRow, type DrumStockRow } from "./sheet.ts";

export const DRUM_DAYS = 15;
const RACCOON_REMARK = "Bare conductor – wound straight on this drum";
/** Drum size text of an order with no drum in the RAW MATERIALS REQUIREMENT sheet (24-Nov update). */
export const MISSING = "Drum size not in RM Requirement sheet – Samrat to fill";
/**
 * An order with no drum size: the build stores one row of 0 drums with no drum code, so the card can list it (Needs
 * action c, compare table). Its drums are not counted anywhere. Issues from before 24-Nov-26 have no drum codes: there
 * a size text with no dimensions in it ("SIZE TO CONFIRM", "Size not known") is the same.
 */
const missing = (r: { drumCode: string | null; drumSize: string }) => !r.drumCode && (/to confirm/i.test(r.drumSize) || !/\d\s*[x×]\s*\d/i.test(r.drumSize));
/** "48×20×32×2.25 (SP0400062)"; issues from before 24-Nov-26 have no drum code. */
const named = (r: { drumSize: string; drumCode: string | null }) => (r.drumCode ? `${r.drumSize} (${r.drumCode})` : r.drumSize);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const party = (partyCable: string) => partyCable.split(" · ")[0];

type Used = { partyCable: string; note?: string | null; usedOn: Day };
/** The drum need has no machine column: a Raccoon row built in the app carries its machine at the head of the note. */
export const raccoonNote = (machine: string) => `${machine}: ${RACCOON_REMARK}`;
/** The machine a Raccoon drum goes on, null for a cable drum. Issues loaded from the sheet name no machine: Skip 10. */
const raccoonOn = (r: Used) => /^(.+): Bare conductor/.exec(r.note ?? "")?.[1] ?? (/raccoon/i.test(`${r.partyCable} ${r.note ?? ""}`) ? "Skip 10" : null);
const usedOn = (r: Used) => `${raccoonOn(r) ?? "Outer sheath"}, ${dMon(r.usedOn)}`;

type Stock = Map<string, DrumStockRow>;
const stockMap = (stock: DrumStockRow[]): Stock => new Map(stock.map((s) => [s.drumCode, s]));

/**
 * Where `needed` flanges of a size come from (rule 10): Kharagpur first, then Poly Park, and what is still short is
 * bought. `problem` / `todo` are the "Needs action" texts of Cards 3 and 4; `buy` > 0 is printed as BUY in red.
 */
function flangeAdvice(drum: { drumSize: string; drumCode: string | null }, stock: Stock, needed: number) {
  const size = drum.drumSize;
  const s = stock.get(codeOf(drum));
  if (!s) return { kgp: 0, pp: 0, buy: 0, blocked: true, problem: `${named(drum)} is not in the Drum Stock sheet`, todo: "Plant to give stock and flanges" };
  if (s.flangesKgp === null) return { kgp: 0, pp: 0, buy: 0, blocked: true, problem: `${size} flanges at Kharagpur to confirm`, todo: `Confirm ${size} flanges` };
  const kgp = Math.min(s.flangesKgp, needed);
  const pp = Math.min(s.flangesPp ?? 0, needed - kgp);
  const buy = needed - kgp - pp;
  const todo = [pp > 0 && `Shift ${plural(pp, "flange", "flanges")} from Poly Park`, buy > 0 && `BUY ${plural(buy, "flange", "flanges")}`].filter(Boolean).join(", then ");
  return { kgp, pp, buy, blocked: false, problem: `${plural(needed, "flange", "flanges")} needed: Kharagpur has ${s.flangesKgp}, Poly Park ${s.flangesPp ?? 0}`, todo: todo || "Flanges at Kharagpur" };
}

export type HeldRow = DrumAssemblyRow & { held: boolean; flangesFrom: string; buy: number };

/**
 * The flange check (rule 10): complete drums from stock are already taken off; each drum to assemble needs 2 flanges,
 * taken from Kharagpur first, then Poly Park, in the order the drums are to be made. What is still short is to be
 * bought, and holds the drum up, as does a size not known or not in the Drum Stock sheet.
 */
export function heldUp(rows: DrumAssemblyRow[], stock: DrumStockRow[]): HeldRow[] {
  const byKey = stockMap(stock);
  const left = new Map<string, { kgp: number; pp: number }>();
  return [...rows]
    .sort((a, b) => a.assembleBy.localeCompare(b.assembleBy) || a.rowNo - b.rowNo)
    .map((r) => {
      const key = codeOf(r);
      const s = byKey.get(key);
      if (!s || s.flangesKgp === null) return { ...r, held: true, buy: 0, flangesFrom: !s ? "Not in the Drum Stock sheet" : "To confirm" };
      const have = left.get(key) ?? { kgp: s.flangesKgp, pp: s.flangesPp ?? 0 };
      const kgp = Math.min(have.kgp, r.flangesNeeded);
      const pp = Math.min(have.pp, r.flangesNeeded - kgp);
      const buy = r.flangesNeeded - kgp - pp;
      left.set(key, { kgp: have.kgp - kgp, pp: have.pp - pp });
      const from = [kgp > 0 && `Kharagpur ${kgp}`, pp > 0 && `Poly Park ${pp} (shift)`, buy > 0 && `BUY ${buy}`].filter(Boolean).join(" + ");
      return { ...r, held: buy > 0, buy, flangesFrom: kgp === r.flangesNeeded ? "Kharagpur stock" : from };
    });
}

/** Rule 32: a row against the issue this one replaces – "new", "same", or "was n". */
export function versus(prev: Map<string, number> | null, key: string, n: number) {
  if (!prev) return null;
  const was = prev.get(key);
  return was === undefined ? "new" : was === n ? "same" : `was ${was}`;
}

export type DrumCell = CalCell & { tone: "work" | "shortd" | "idle"; n: number; text: string };
const firstSeen = <T>(rows: T[], key: (r: T) => string) => [...new Set(rows.map(key))];
const allAnd = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? ""));
/** The drum need rows a card shows, in the row order of the guide. */
const inCard = (need: DrumNeedRow[], d0: Day) =>
  need.filter((r) => (r.drumsNeeded > 0 || missing(r)) && r.readyBy <= addDays(d0, DRUM_DAYS - 1)).sort((a, b) => a.readyBy.localeCompare(b.readyBy) || a.rowNo - b.rowNo);

// ── Card 4: KGP Drum Assembly Card ───────────────────────────────────────
/** `need` is the drum need of the same issue: it tells which machine a Raccoon drum goes on. */
export function drumAssemblyCard(assembly: DrumAssemblyRow[], stock: DrumStockRow[], d0: Day, need: DrumNeedRow[] = []) {
  const last = addDays(d0, DRUM_DAYS - 1);
  // Orders with no drum size never reach this card: Card 3 lists them.
  const rows = heldUp(assembly.filter((r) => r.drums > 0 && r.assembleBy <= last && !missing(r)), stock);
  const byKey = stockMap(stock);
  const sum = (list: HeldRow[]) => list.reduce((s, r) => s + r.drums, 0);
  const byDay = Map.groupBy(rows, (r) => r.assembleBy);
  const held = rows.filter((r) => r.held);
  const keyOf = codeOf;
  const noteOf = new Map(need.map((r) => [`${r.prodOrder}|${r.usedOn}`, r.note]));

  return {
    facts: {
      period: `Drums to be made from ${dMon(d0)} to ${dMon(last)} ${last.slice(0, 4)}`,
      toMake: sum(rows),
      flanges: rows.reduce((s, r) => s + r.flangesNeeded, 0),
      canMake: sum(rows) - sum(held),
      heldUp: sum(held),
      late: sum(rows.filter((r) => r.was)),
      d0: dMon(d0),
    },
    calendar: weeks(d0, DRUM_DAYS).map((week) =>
      week.map((c): DrumCell & { held: number } => {
        const day = byDay.get(c.day) ?? [];
        const n = sum(day);
        const b = sum(day.filter((r) => r.held));
        return { ...c, n, held: b, tone: n === 0 ? "idle" : b === 0 ? "work" : "shortd", text: n === 0 ? "none" : b === 0 ? "all ok" : `${b} held up` };
      }),
    ),
    cannot: firstSeen(held, keyOf).map((key) => {
      const of = held.filter((r) => keyOf(r) === key);
      // Every row of the size, held up or not: they all draw on the same flanges.
      const all = rows.filter((r) => keyOf(r) === key);
      const advice = flangeAdvice(of[0], byKey, all.reduce((s, r) => s + r.flangesNeeded, 0));
      return { code: key, size: of[0].drumSize, known: true, drums: sum(of), problem: `${advice.problem} (for ${allAnd(firstSeen(all, (r) => party(r.partyCable)))})`, todo: advice.todo, buy: advice.buy };
    }),
    rows: rows.map((r, i) => ({
      first: i === 0 || rows[i - 1].assembleBy !== r.assembleBy,
      makeBy: dMon(r.assembleBy),
      dayTotal: `${sum(byDay.get(r.assembleBy)!)} drums`,
      size: { text: r.drumSize, known: true },
      late: !!r.was,
      drums: r.drums,
      flanges: r.flangesNeeded,
      flangesFrom: r.flangesFrom,
      buy: r.buy,
      held: r.held,
      key: `${r.prodOrder}|${r.usedOn}`,
      partyCable: r.partyCable,
      orderLot: `${r.prodOrder} · ${r.lot}`,
      usedOn: usedOn({ ...r, note: noteOf.get(`${r.prodOrder}|${r.usedOn}`) }),
    })),
    total: { drums: sum(rows), flanges: rows.reduce((s, r) => s + r.flangesNeeded, 0) },
  };
}

// ── Card 3: KGP Finished Goods Drum Requirement Card ─────────────────────
export function drumRequirementCard(need: DrumNeedRow[], stock: DrumStockRow[], d0: Day) {
  const last = addDays(d0, DRUM_DAYS - 1);
  const shown = inCard(need, d0);
  // An order with no drum size is listed under Needs action, but its drums are not counted anywhere.
  const rows = shown.filter((r) => !missing(r));
  const byKey = stockMap(stock);
  const isLate = (r: DrumNeedRow) => r.readyBy < d0;
  const late = rows.filter(isLate);
  const tot = (list: DrumNeedRow[], f: (r: DrumNeedRow) => number) => list.reduce((s, r) => s + f(r), 0);
  const needed = (r: DrumNeedRow) => r.drumsNeeded;
  const make = (r: DrumNeedRow) => r.toAssemble;
  const keyOf = codeOf;
  const byDay = Map.groupBy(rows.filter((r) => !isLate(r)), (r) => r.readyBy);

  const bySize = firstSeen(rows, keyOf).map((key) => {
    const of = rows.filter((r) => keyOf(r) === key);
    const toMake = tot(of, make);
    // Guide 4.2: a flange stock that is not a number, or a drum code not in the Drum Stock sheet, counts as 0.
    const flangesKgp: number | null = byKey.get(key)?.flangesKgp ?? 0;
    return { code: key, size: of[0].drumSize, known: true, raw: of[0], needed: tot(of, needed), inStock: tot(of, (r) => r.fromStock), toMake, flangesNeeded: toMake * 2, flangesKgp, flangesShort: flangesKgp !== null && flangesKgp < toMake * 2 };
  });

  const before = `needed before ${dMon(d0)}`;
  const unknown = shown.filter(missing);

  // More flanges needed than Kharagpur has: shift from Poly Park, then BUY.
  const flangeRows = bySize
    .filter((s) => s.flangesShort)
    .map((s) => {
      const advice = flangeAdvice(s.raw, byKey, s.flangesNeeded);
      // Guide 4.3 step 7b, first case: a drum code not in the Drum Stock sheet.
      const todo = byKey.has(s.code) ? advice.todo : `${advice.problem} – plant to give stock and flanges`;
      return { size: s.size, known: true, problem: `${plural(s.toMake, "drum", "drums")} to be made: ${advice.problem}`, todo, buy: advice.buy };
    });
  // Late and not in stock: the drum team makes these first.
  const lateRows = firstSeen(late.filter((r) => make(r) > 0), keyOf).map((key) => {
    const of = late.filter((r) => keyOf(r) === key && make(r) > 0);
    const n = tot(of, make);
    return { size: of[0].drumSize, known: true, problem: `${plural(n, "drum", "drums")} should already be ready (${before}) and ${n === 1 ? "is" : "are"} not in stock`, todo: "Drum team to assemble these first", buy: 0 };
  });
  const orders = [...new Map(unknown.map((r) => [r.prodOrder, `${r.prodOrder} ${party(r.partyCable)}`])).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text);
  const unknownRows = unknown.length
    ? [{ size: MISSING, known: false, problem: `${plural(orders.length, "order", "orders")}: ${orders.join(", ")}`, todo: "Samrat to fill the drum code for these contracts in the RAW MATERIALS REQUIREMENT sheet", buy: 0 }]
    : [];

  return {
    facts: {
      period: `Drums to be ready from ${dMon(d0)} to ${dMon(last)} ${last.slice(0, 4)}`,
      needed: tot(rows, needed),
      inStock: tot(rows, (r) => r.fromStock),
      toMake: tot(rows, make),
      flanges: tot(rows, make) * 2,
    },
    lateLine: `Already late (${before}): ${plural(tot(late, needed), "drum", "drums")}, ${tot(late, make)} of them still to be made`,
    calendar: weeks(d0, DRUM_DAYS).map((week) =>
      week.map((c): DrumCell => {
        const day = byDay.get(c.day) ?? [];
        const n = tot(day, needed);
        const a = tot(day, make);
        return { ...c, n, tone: n === 0 ? "idle" : a === 0 ? "work" : "shortd", text: n === 0 ? "no drums" : a === 0 ? "all in stock" : `${a} to make` };
      }),
    ),
    needsAction: [...lateRows, ...flangeRows, ...unknownRows],
    bySize,
    total: { needed: tot(rows, needed), inStock: tot(rows, (r) => r.fromStock), toMake: tot(rows, make), flanges: tot(rows, make) * 2 },
    rows: rows.map((r, i) => {
      const group = isLate(r) ? "late" : r.readyBy;
      const prev = i > 0 ? (isLate(rows[i - 1]) ? "late" : rows[i - 1].readyBy) : null;
      const remark = raccoonOn(r) ? RACCOON_REMARK : (r.note ?? "");
      return {
        first: group !== prev,
        late: isLate(r),
        readyBy: dMon(r.readyBy),
        size: { text: r.drumSize, known: true },
        key: `${r.prodOrder}|${r.usedOn}`,
        needed: r.drumsNeeded,
        fromStock: r.fromStock,
        toMake: r.toAssemble,
        partyCable: r.partyCable,
        orderLot: `${r.prodOrder} · ${r.lot}`,
        usedOn: usedOn(r),
        remark,
        remarkAttention: /plant to confirm/i.test(remark),
      };
    }),
  };
}

// ── Cards 3 and 4: what changed since the issue this one replaces ────────
type Version = { issueDate: Day; rev: number; d0: Day };
/** "21-Nov Rev 4" */
const shortName = (i: Version) => `${ddMonYy(i.issueDate).slice(0, 6)} Rev ${i.rev}`;

/** The change box and the compare table (Card 3 guide 4.3, steps 5 and 6), the same on both cards. */
export function drumChanges(issue: Version & { issueNote: string }, prev: Version, need: DrumNeedRow[], prevNeed: DrumNeedRow[]) {
  const now = inCard(need, issue.d0);
  const was = inCard(prevNeed, prev.d0);
  const sum = (rows: DrumNeedRow[]) => rows.reduce((s, r) => s + r.toAssemble, 0);
  const cell = (rows: DrumNeedRow[], d0: Day) => {
    const make = rows.filter((r) => r.toAssemble > 0);
    if (!make.length) return "none";
    const days = make.filter((r) => r.readyBy >= d0).map((r) => r.readyBy).sort();
    const late = sum(make.filter((r) => r.readyBy < d0));
    const dates = days.length ? `, ${dMon(days[0])}${days.at(-1) !== days[0] ? `–${dMon(days.at(-1)!)}` : ""}` : "";
    return `${plural(sum(make), "drum", "drums")}${dates}${late ? ` (${late} late)` : ""}`;
  };
  return {
    name: shortName(issue),
    prevName: shortName(prev),
    note: issue.issueNote,
    upTo: dMon(addDays(issue.d0, DRUM_DAYS - 1)),
    toMake: sum(now),
    prevToMake: sum(was),
    rows: [...new Set([...now, ...was].map((r) => r.prodOrder))].sort().map((prodOrder) => {
      const mine = now.filter((r) => r.prodOrder === prodOrder);
      const theirs = was.filter((r) => r.prodOrder === prodOrder);
      const one = mine[0] ?? theirs[0];
      return { order: `${one.partyCable} (${prodOrder.slice(-3)})`, size: missing(one) ? MISSING : one.drumSize.split(" +")[0], known: !missing(one), prev: cell(theirs, prev.d0), now: cell(mine, issue.d0) };
    }),
  };
}
