// Cards 3 and 4, finished-goods drums: figures from the FG drum need, Drum assembly and Drum stock rows (build spec 7.5, 8, 9).
import { addDays, dMon, weeks, type CalCell } from "./calendar.ts";
import { sizeKey, type Day, type DrumAssemblyRow, type DrumNeedRow, type DrumStockRow } from "./sheet.ts";

export const DRUM_DAYS = 15;
const UNKNOWN = "Size not known";

/** The plant has not given a drum size for the order ("SIZE TO CONFIRM" in the sheet). */
export const sizeLabel = (size: string) => (/to confirm/i.test(size) || !size.trim() ? { text: UNKNOWN, known: false } : { text: size, known: true });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** First number of a drum size: its flange diameter in inches. */
const inches = (size: string) => /^\s*(\d+)/.exec(size)?.[1] ?? "";
const party = (partyCable: string) => partyCable.split(" · ")[0];
const isRaccoon = (r: { partyCable: string; note?: string | null }) => /raccoon/i.test(`${r.partyCable} ${r.note ?? ""}`);
const usedOn = (r: { partyCable: string; note?: string | null; usedOn: Day }) => `${isRaccoon(r) ? "Skip 10" : "Outer sheath"}, ${dMon(r.usedOn)}`;

type Stock = Map<string, DrumStockRow>;
const stockMap = (stock: DrumStockRow[]): Stock => new Map(stock.map((s) => [s.sizeKey, s]));

/** What to tell the plant when a size cannot be made for want of flanges (build spec 8.3, 9.3). */
function flangeAdvice(size: string, stock: Stock) {
  const { known } = sizeLabel(size);
  const s = stock.get(sizeKey(size));
  const n = inches(size);
  if (!known) return { from: UNKNOWN, problem: "Drum size not given for the order", todo: "Plant to give the drum size for each order" };
  if (n === "84") return { from: "No flanges – to be bought", problem: "No 84″ flanges at Kharagpur", todo: "Buy 84″ flanges, or decide another drum size" };
  if (n === "70") return { from: "No flanges – buy 2, or use a complete 70″ drum", problem: "No 70″ flanges at Kharagpur", todo: "Buy 2 flanges, or use a complete 70″ drum from the yard" };
  if (n === "36") {
    const kgp = s?.flangesKgp ?? 0;
    return { from: `Poly Park (only ${kgp} at Kharagpur)`, problem: `Only ${plural(kgp, "flange", "flanges")} at Kharagpur`, todo: `Shift flanges from Poly Park (${(s?.flangesPp ?? 0).toLocaleString("en-IN")} there)` };
  }
  return { from: "Not enough at Kharagpur", problem: "Not enough flanges at Kharagpur", todo: "Arrange flanges" };
}

export type HeldRow = DrumAssemblyRow & { held: boolean; flangesFrom: string };

/**
 * A drum is held up when its size is not known or Kharagpur has too few flanges left for it.
 * Flanges are used up in the order the drums are to be made (build spec 7.5).
 */
export function heldUp(rows: DrumAssemblyRow[], stock: DrumStockRow[]): HeldRow[] {
  const byKey = stockMap(stock);
  const left = new Map<string, number>();
  return [...rows]
    .sort((a, b) => a.assembleBy.localeCompare(b.assembleBy) || a.rowNo - b.rowNo)
    .map((r) => {
      const key = sizeKey(r.drumSize);
      const have = left.get(key) ?? byKey.get(key)?.flangesKgp ?? 0;
      const held = !sizeLabel(r.drumSize).known || have < r.flangesNeeded;
      left.set(key, Math.max(0, have - r.flangesNeeded));
      return { ...r, held, flangesFrom: held ? flangeAdvice(r.drumSize, byKey).from : "Kharagpur stock" };
    });
}

export type DrumCell = CalCell & { tone: "work" | "shortd" | "idle"; n: number; text: string };
const firstSeen = <T>(rows: T[], key: (r: T) => string) => [...new Set(rows.map(key))];

// ── Card 4: KGP Drum Assembly Card ───────────────────────────────────────
export function drumAssemblyCard(assembly: DrumAssemblyRow[], stock: DrumStockRow[], d0: Day) {
  const last = addDays(d0, DRUM_DAYS - 1);
  const rows = heldUp(assembly.filter((r) => r.drums > 0 && r.assembleBy <= last), stock);
  const byKey = stockMap(stock);
  const sum = (list: HeldRow[]) => list.reduce((s, r) => s + r.drums, 0);
  const byDay = Map.groupBy(rows, (r) => r.assembleBy);
  const held = rows.filter((r) => r.held);

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
    cannot: firstSeen(held, (r) => sizeKey(sizeLabel(r.drumSize).known ? r.drumSize : UNKNOWN)).map((key) => {
      const of = held.filter((r) => sizeKey(sizeLabel(r.drumSize).known ? r.drumSize : UNKNOWN) === key);
      const advice = flangeAdvice(of[0].drumSize, byKey);
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
      usedOn: usedOn(r),
    })),
    total: { drums: sum(rows), flanges: rows.reduce((s, r) => s + r.flangesNeeded, 0) },
  };
}

// ── Card 3: KGP Finished Goods Drum Requirement Card ─────────────────────
export function drumRequirementCard(need: DrumNeedRow[], stock: DrumStockRow[], d0: Day) {
  const last = addDays(d0, DRUM_DAYS - 1);
  const rows = need.filter((r) => r.drumsNeeded > 0 && r.readyBy <= last).sort((a, b) => a.readyBy.localeCompare(b.readyBy) || a.rowNo - b.rowNo);
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
    const flangesKgp = label.known ? (byKey.get(key)?.flangesKgp ?? null) : null;
    return { size: label.text, known: label.known, raw: of[0].drumSize, needed: tot(of, needed), inStock: tot(of, (r) => r.fromStock), toMake, flangesNeeded: toMake * 2, flangesKgp, flangesShort: flangesKgp !== null && flangesKgp < toMake * 2 };
  });

  const before = `needed before ${dMon(d0)}`;
  const unknown = rows.filter((r) => !sizeLabel(r.drumSize).known);

  // More flanges needed than Kharagpur has.
  const flangeRows = bySize
    .filter((s) => s.known && s.toMake > 0 && (s.flangesKgp ?? 0) < s.flangesNeeded)
    .map((s) => ({
      size: s.size,
      known: true,
      problem: `${plural(s.toMake, "drum", "drums")} to be made ${s.toMake === 1 ? "needs" : "need"} ${plural(s.flangesNeeded, "flange", "flanges")}. Kharagpur has only ${s.flangesKgp ?? 0}`,
      todo: flangeAdvice(s.raw, byKey).todo,
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
    lateLine: late.length ? `Already late (${before}): ${plural(tot(late, needed), "drum", "drums")}, ${tot(late, make)} of them still to be made` : null,
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
        remark: isRaccoon(r) ? "Bare conductor – wound straight on this drum" : label.known ? (r.note ?? "") : "Plant to give the drum size",
        remarkAttention: !label.known,
      };
    }),
  };
}
