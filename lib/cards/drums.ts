// Cards 3 and 4, finished-goods drums: figures from the FG drum need, Drum assembly and Drum stock rows
// (Card 3 guide v4 and Card 4 guide v1, sections 4.2 and 4.3).
import { addDays, ddMonYy, dMon, weeks, type CalCell } from "./calendar.ts";
import { sizeKey, type Day, type DrumAssemblyRow, type DrumNeedRow, type DrumStockRow } from "./sheet.ts";

export const DRUM_DAYS = 15;
const UNKNOWN = "Size not known";
const RACCOON_REMARK = "Bare conductor – wound straight on this drum";
const GIVE_SIZE = "Plant to give the drum size";

/**
 * The plant has not given a drum size for the order: "SIZE TO CONFIRM" in the sheet, or any text without
 * dimensions in it ("TBC", "-"). A real size reads like 84×35×38×3.
 */
export const sizeLabel = (size: string) => (/to confirm/i.test(size) || !/\d\s*[x×]\s*\d/i.test(size) ? { text: UNKNOWN, known: false } : { text: size, known: true });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** First number of a drum size: its flange diameter in inches. */
const inches = (size: string) => /^\s*(\d+)/.exec(size)?.[1] ?? "";
const party = (partyCable: string) => partyCable.split(" · ")[0];

type Used = { partyCable: string; note?: string | null; usedOn: Day };
/** The drum need has no machine column: a Raccoon row built in the app carries its machine at the head of the note. */
export const raccoonNote = (machine: string) => `${machine}: ${RACCOON_REMARK}`;
/** The machine a Raccoon drum goes on, null for a cable drum. Issues loaded from the sheet name no machine: Skip 10. */
const raccoonOn = (r: Used) => /^(.+): Bare conductor/.exec(r.note ?? "")?.[1] ?? (/raccoon/i.test(`${r.partyCable} ${r.note ?? ""}`) ? "Skip 10" : null);
const usedOn = (r: Used) => `${raccoonOn(r) ?? "Outer sheath"}, ${dMon(r.usedOn)}`;

type Stock = Map<string, DrumStockRow>;
const stockMap = (stock: DrumStockRow[]): Stock => new Map(stock.map((s) => [s.sizeKey, s]));

/**
 * What to tell the plant when a size cannot be made for want of flanges: `from`, `problem` and `todo` are the
 * Card 4 texts (guide 4.1 and 4.3 step 6), `need` is the "What to do" of Card 3 (guide 4.3 step 7b).
 */
function flangeAdvice(size: string, stock: Stock, forWhom = "") {
  const s = stock.get(sizeKey(size));
  const n = inches(size);
  if (!sizeLabel(size).known) return { from: UNKNOWN, problem: "Drum size not given for the order", todo: "Plant to give the drum size for each order", need: "Plant to give the drum size for each order" };
  if (!s) return { from: "Not in the Drum Stock sheet", problem: `${size} is not in the Drum Stock sheet`, todo: "Plant to give stock and flanges", need: `Plant to give stock and flanges of ${size}` };
  if (s.flangesKgp === null) return { from: "To confirm", problem: `${size} flanges to confirm`, todo: "Confirm flanges", need: `Confirm ${size} flanges` };
  const pp = s.flangesPp ? s.flangesPp.toLocaleString("en-IN") : null;
  const inch = n ? `${n}″ ` : "";
  const shift = pp ? `Shift ${inch}flanges from Poly Park (${pp} there)` : "Arrange flanges";
  if (n === "84") return { from: "No flanges – to be bought", problem: "No 84″ flanges at Kharagpur", todo: "Buy 84″ flanges, or decide another drum size", need: "Buy 84″ flanges, or decide another drum size" };
  if (n === "70") return { from: "No flanges – buy 2, or use a complete 70″ drum", problem: "No 70″ flanges at Kharagpur", todo: "Buy 2 flanges, or use a complete 70″ drum from the yard", need: "Buy 2 flanges, or use a complete 70″ drum from the yard" };
  if (n === "36") return { from: `Poly Park (only ${s.flangesKgp} at Kharagpur)`, problem: `Only ${s.flangesKgp} flanges at Kharagpur`, todo: `Shift flanges from Poly Park (${pp ?? 0} there)`, need: shift };
  return { from: pp ? `Shift from Poly Park (${pp} there)` : "Not enough at Kharagpur", problem: `Kharagpur ${inch}flanges (${s.flangesKgp}) not enough for ${forWhom}`, todo: shift, need: shift };
}

export type HeldRow = DrumAssemblyRow & { held: boolean; flangesFrom: string };

/**
 * The flange check (Card 4 guide 4.1): a drum is held up when its size is not known, is not in the Drum Stock
 * sheet, or Kharagpur has too few flanges left for it. Flanges are used up in the order the drums are to be
 * made, by held-up rows too.
 */
export function heldUp(rows: DrumAssemblyRow[], stock: DrumStockRow[]): HeldRow[] {
  const byKey = stockMap(stock);
  const left = new Map<string, number>();
  return [...rows]
    .sort((a, b) => a.assembleBy.localeCompare(b.assembleBy) || a.rowNo - b.rowNo)
    .map((r) => {
      const key = sizeKey(r.drumSize);
      const have = sizeLabel(r.drumSize).known ? (left.get(key) ?? byKey.get(key)?.flangesKgp ?? null) : null;
      const held = have === null || have < r.flangesNeeded;
      if (have !== null) left.set(key, Math.max(0, have - r.flangesNeeded));
      return { ...r, held, flangesFrom: held ? flangeAdvice(r.drumSize, byKey).from : "Kharagpur stock" };
    });
}

export type DrumCell = CalCell & { tone: "work" | "shortd" | "idle"; n: number; text: string };
const firstSeen = <T>(rows: T[], key: (r: T) => string) => [...new Set(rows.map(key))];
const allAnd = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? ""));
/** The drum need rows a card shows, in the row order of the guide. */
const inCard = (need: DrumNeedRow[], d0: Day) =>
  need.filter((r) => r.drumsNeeded > 0 && r.readyBy <= addDays(d0, DRUM_DAYS - 1)).sort((a, b) => a.readyBy.localeCompare(b.readyBy) || a.rowNo - b.rowNo);

// ── Card 4: KGP Drum Assembly Card ───────────────────────────────────────
/** `need` is the drum need of the same issue: it tells which machine a Raccoon drum goes on. */
export function drumAssemblyCard(assembly: DrumAssemblyRow[], stock: DrumStockRow[], d0: Day, need: DrumNeedRow[] = []) {
  const last = addDays(d0, DRUM_DAYS - 1);
  const rows = heldUp(assembly.filter((r) => r.drums > 0 && r.assembleBy <= last), stock);
  const byKey = stockMap(stock);
  const sum = (list: HeldRow[]) => list.reduce((s, r) => s + r.drums, 0);
  const byDay = Map.groupBy(rows, (r) => r.assembleBy);
  const held = rows.filter((r) => r.held);
  const keyOf = (r: HeldRow) => sizeKey(sizeLabel(r.drumSize).known ? r.drumSize : UNKNOWN);
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
      const advice = flangeAdvice(of[0].drumSize, byKey, allAnd(firstSeen(rows.filter((r) => keyOf(r) === key), (r) => party(r.partyCable))));
      return { size: sizeLabel(of[0].drumSize).text, known: sizeLabel(of[0].drumSize).known, drums: sum(of), problem: advice.problem, todo: advice.todo };
    }),
    rows: rows.map((r, i) => ({
      first: i === 0 || rows[i - 1].assembleBy !== r.assembleBy,
      makeBy: dMon(r.assembleBy),
      dayTotal: `${sum(byDay.get(r.assembleBy)!)} drums`,
      size: sizeLabel(r.drumSize),
      late: !!r.was,
      drums: r.drums,
      flanges: r.flangesNeeded,
      flangesFrom: r.flangesFrom,
      held: r.held,
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
  const rows = inCard(need, d0);
  const byKey = stockMap(stock);
  const isLate = (r: DrumNeedRow) => r.readyBy < d0;
  const late = rows.filter(isLate);
  const tot = (list: DrumNeedRow[], f: (r: DrumNeedRow) => number) => list.reduce((s, r) => s + f(r), 0);
  const needed = (r: DrumNeedRow) => r.drumsNeeded;
  const make = (r: DrumNeedRow) => r.toAssemble;
  const keyOf = (r: DrumNeedRow) => (sizeLabel(r.drumSize).known ? sizeKey(r.drumSize) : UNKNOWN);
  const byDay = Map.groupBy(rows.filter((r) => !isLate(r)), (r) => r.readyBy);

  const bySize = firstSeen(rows, keyOf).map((key) => {
    const of = rows.filter((r) => keyOf(r) === key);
    const label = sizeLabel(of[0].drumSize);
    const toMake = tot(of, make);
    // Guide 4.2: a flange stock that is not a number counts as 0; "Size not known" shows "–".
    const flangesKgp = label.known ? (byKey.get(key)?.flangesKgp ?? 0) : null;
    return { size: label.text, known: label.known, raw: of[0].drumSize, needed: tot(of, needed), inStock: tot(of, (r) => r.fromStock), toMake, flangesNeeded: toMake * 2, flangesKgp, flangesShort: flangesKgp !== null && flangesKgp < toMake * 2 };
  });

  const before = `needed before ${dMon(d0)}`;
  const unknown = rows.filter((r) => !sizeLabel(r.drumSize).known);

  // More flanges needed than Kharagpur has.
  const flangeRows = bySize
    .filter((s) => s.flangesShort)
    .map((s) => ({
      size: s.size,
      known: true,
      problem: `${plural(s.toMake, "drum", "drums")} to be made ${s.toMake === 1 ? "needs" : "need"} ${plural(s.flangesNeeded, "flange", "flanges")}. Kharagpur has only ${s.flangesKgp}`,
      todo: flangeAdvice(s.raw, byKey).need,
    }));
  // Late and not in stock: the drum team makes these first.
  const lateRows = firstSeen(late.filter((r) => make(r) > 0), keyOf).map((key) => {
    const of = late.filter((r) => keyOf(r) === key && make(r) > 0);
    const n = tot(of, make);
    return { size: sizeLabel(of[0].drumSize).text, known: sizeLabel(of[0].drumSize).known, problem: `${plural(n, "drum", "drums")} should already be ready (${before}) and ${n === 1 ? "is" : "are"} not in stock`, todo: "Drum team to assemble these first" };
  });
  const orders = [...new Map(unknown.map((r) => [r.prodOrder, `${r.prodOrder} ${party(r.partyCable)}`])).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text);
  const unknownRows = unknown.length
    ? [{ size: UNKNOWN, known: false, problem: `${plural(tot(unknown, needed), "drum", "drums")} for ${plural(orders.length, "order", "orders")} have no drum size: ${orders.join(", ")}`, todo: "Plant to give the drum size for each order" }]
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
      const label = sizeLabel(r.drumSize);
      const group = isLate(r) ? "late" : r.readyBy;
      const prev = i > 0 ? (isLate(rows[i - 1]) ? "late" : rows[i - 1].readyBy) : null;
      const remark = raccoonOn(r) ? RACCOON_REMARK : label.known ? (r.note ?? "") : GIVE_SIZE;
      return {
        first: group !== prev,
        late: isLate(r),
        readyBy: dMon(r.readyBy),
        size: label,
        needed: r.drumsNeeded,
        fromStock: r.fromStock,
        toMake: r.toAssemble,
        partyCable: r.partyCable,
        orderLot: `${r.prodOrder} · ${r.lot}`,
        usedOn: usedOn(r),
        remark,
        remarkAttention: remark === GIVE_SIZE,
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
      const size = sizeLabel(one.drumSize);
      return { order: `${one.partyCable} (${prodOrder.slice(-3)})`, size: size.text.split(" +")[0], known: size.known, prev: cell(theirs, prev.d0), now: cell(mine, issue.d0) };
    }),
  };
}
