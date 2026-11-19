// Turns the card tabs of the data sheet into typed rows. Tabs are read by heading, never by column letter (build spec 1).
import { mapRows, type FieldSpec } from "../sheets/headers.ts";
import { MACHINE_ORDER } from "./machines.ts";

/** A calendar day as yyyy-mm-dd. */
export type Day = string;

export type PlanRow = {
  version: string;
  rowNo: number;
  day: Day;
  process: string;
  machine: string;
  prodOrder: string;
  mc: string;
  partyCable: string;
  lot: string;
  qty: number;
  unit: string;
  sizeCore: string;
  material: string;
  feed: string;
  feedStatus: "ok" | "drum" | "wait";
  job: string;
};
export type LabourRow = {
  version: string;
  rowNo: number;
  day: Day;
  shift: "Day" | "Night";
  machine: string;
  operator: string | null;
  helpers: string[];
  menNeeded: number;
  menGiven: number;
  note: string | null;
};
export type SpareRow = { version: string; day: Day; shift: "Day" | "Night"; men: string[] };
export type DrumNeedRow = {
  version: string;
  rowNo: number;
  usedOn: Day;
  readyBy: Day;
  late: boolean;
  drumSize: string;
  drumsNeeded: number;
  fromStock: number;
  toAssemble: number;
  prodOrder: string;
  partyCable: string;
  lot: string;
  note: string | null;
};
export type DrumAssemblyRow = {
  version: string;
  rowNo: number;
  assembleBy: Day;
  was: Day | null;
  drumSize: string;
  drums: number;
  flangesNeeded: number;
  flangesFrom: string;
  prodOrder: string;
  partyCable: string;
  lot: string;
  usedOn: Day;
};
export type DrumStockRow = { sizeKey: string; drumSize: string; drums: number | null; flangesKgp: number | null; flangesPp: number | null };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function textDay(s: string): Day | null {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(s);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (!m || !month) return null;
  return iso(Number(m[3]) + (m[3].length === 2 ? 2000 : 0), month, Number(m[1]));
}

/** "17-Nov-26", "13-Nov-26 (LATE)", "17-Nov-26 (LATE – was 13-Nov-26)", or a Sheets serial number. */
export function parseDay(v: unknown): { day: Day; late: boolean; was: Day | null } {
  // Sheets counts days from 30-Dec-1899.
  if (typeof v === "number") return { day: new Date(Date.UTC(1899, 11, 30 + Math.floor(v))).toISOString().slice(0, 10), late: false, was: null };
  const s = String(v ?? "");
  const [head, tail = ""] = s.split("(");
  const day = textDay(head);
  if (!day) throw new Error(`Not a date: "${s}"`);
  return { day, late: /late/i.test(tail), was: textDay(tail) };
}

/** One key for a drum size however it is typed: "84 X 35 X 38 X 3 + EXTRA SEGMENT" = "84×35×38×3 + extra segment". */
export const sizeKey = (s: string) => s.toLowerCase().replace(/×/g, "x").replace(/[\s-]/g, "");

/** Issue date and revision number from the version text. The year comes from day 0 when the text has none. */
export function parseVersion(text: string, d0: Day): { issueDate: Day; rev: number | null } {
  const d = /(\d{1,2})-([A-Za-z]{3})(?:-(\d{2,4}))?/.exec(text);
  const month = d ? MONTHS.indexOf(d[2].toLowerCase()) + 1 : 0;
  const year = d?.[3] ? Number(d[3]) + (d[3].length === 2 ? 2000 : 0) : Number(d0.slice(0, 4));
  const rev = /\bR(?:ev)?\s*(\d+)/i.exec(text);
  return { issueDate: d && month ? iso(year, month, Number(d[1])) : d0, rev: rev ? Number(rev[1]) : null };
}

// Headings carry notes in brackets that change ("Current stock (fill)"); the words before the bracket are the name.
function rows(values: unknown[][], fields: FieldSpec) {
  const [head = [], ...rest] = values;
  return mapRows([head.map((h) => String(h ?? "").replace(/\s*\(.*$/, "")), ...rest], fields);
}

const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown, what: string) => {
  const n = typeof v === "number" ? v : Number(str(v).replace(/,/g, ""));
  if (v === null || v === "" || !Number.isFinite(n)) throw new Error(`${what}: not a number: "${str(v)}"`);
  return n;
};
const numOrNull = (v: unknown) => (typeof v === "number" ? v : null);
const list = (v: unknown) => str(v).split(",").map((s) => s.trim()).filter(Boolean);
const known = (machine: string, tab: string) => {
  if (!(MACHINE_ORDER as readonly string[]).includes(machine)) throw new Error(`${tab}: unknown machine "${machine}"`);
  return machine;
};
const shift = (v: unknown, tab: string) => {
  const s = str(v);
  if (s !== "Day" && s !== "Night") throw new Error(`${tab}: unknown shift "${s}"`);
  return s;
};
const h = (...headers: string[]) => ({ headers });
const opt = (...headers: string[]) => ({ headers, optional: true });

export function parseCardPlan(values: unknown[][]): PlanRow[] {
  return rows(values, {
    version: h("Version"), day: h("Date"), process: h("Process"), machine: h("Machine"), prodOrder: h("Production order"), mc: h("MC"),
    partyCable: h("Party · cable"), lot: h("Lot"), qty: h("Plan qty"), unit: h("Unit"), sizeCore: h("Size / core"),
    material: h("Raw material to consume"), feed: h("Feed from previous process"), feedStatus: h("Feed status"), job: h("Job"),
  }).map((r, rowNo) => {
    const feedStatus = str(r.feedStatus);
    if (feedStatus !== "ok" && feedStatus !== "drum" && feedStatus !== "wait") throw new Error(`Card plan: unknown feed status "${feedStatus}"`);
    return {
      version: str(r.version), rowNo, day: parseDay(r.day).day, process: str(r.process), machine: known(str(r.machine), "Card plan"),
      prodOrder: str(r.prodOrder), mc: str(r.mc), partyCable: str(r.partyCable), lot: str(r.lot), qty: num(r.qty, "Card plan, Plan qty"),
      unit: str(r.unit), sizeCore: str(r.sizeCore), material: str(r.material), feed: str(r.feed), feedStatus, job: str(r.job),
    };
  });
}

export function parseLabour(values: unknown[][]): LabourRow[] {
  return rows(values, {
    version: h("Version"), day: h("Date"), shift: h("Shift"), machine: h("Machine"), operator: h("Operator"), helpers: h("Helpers"),
    menNeeded: h("Men needed"), menGiven: h("Men given"), note: opt("Note"),
  }).map((r, rowNo) => ({
    version: str(r.version), rowNo, day: parseDay(r.day).day, shift: shift(r.shift, "Labour allocation"), machine: known(str(r.machine), "Labour allocation"),
    operator: str(r.operator) || null, helpers: list(r.helpers), menNeeded: num(r.menNeeded, "Labour allocation, Men needed"),
    menGiven: num(r.menGiven, "Labour allocation, Men given"), note: str(r.note) || null,
  }));
}

export function parseSpareMen(values: unknown[][]): SpareRow[] {
  return rows(values, { version: h("Version"), day: h("Date"), shift: h("Shift"), men: h("Men not allotted to a machine") }).map((r) => ({
    version: str(r.version), day: parseDay(r.day).day, shift: shift(r.shift, "Spare men"), men: list(r.men),
  }));
}

export function parseDrumNeed(values: unknown[][]): DrumNeedRow[] {
  return rows(values, {
    version: h("Version"), usedOn: h("Used on"), readyBy: h("Ready by"), drumSize: h("Drum size"), drumsNeeded: h("Drums needed"),
    fromStock: h("From stock"), toAssemble: h("To assemble"), prodOrder: h("Production order"), partyCable: h("Party · cable"), lot: h("Lot"), note: opt("Note"),
  }).map((r, rowNo) => {
    const ready = parseDay(r.readyBy);
    return {
      version: str(r.version), rowNo, usedOn: parseDay(r.usedOn).day, readyBy: ready.day, late: ready.late, drumSize: str(r.drumSize),
      drumsNeeded: num(r.drumsNeeded, "FG drum need, Drums needed"), fromStock: num(r.fromStock, "FG drum need, From stock"),
      toAssemble: num(r.toAssemble, "FG drum need, To assemble"), prodOrder: str(r.prodOrder), partyCable: str(r.partyCable), lot: str(r.lot), note: str(r.note) || null,
    };
  });
}

export function parseDrumAssembly(values: unknown[][]): DrumAssemblyRow[] {
  return rows(values, {
    version: h("Version"), assembleBy: h("Assemble by"), drumSize: h("Drum size"), drums: h("Drums to make"), flangesNeeded: h("Flanges needed"),
    flangesFrom: h("Flanges from"), prodOrder: h("Production order"), partyCable: h("Party · cable"), lot: h("Lot"), usedOn: h("Drum used on"),
  }).map((r, rowNo) => {
    const by = parseDay(r.assembleBy);
    return {
      version: str(r.version), rowNo, assembleBy: by.day, was: by.was, drumSize: str(r.drumSize), drums: num(r.drums, "Drum assembly, Drums to make"),
      flangesNeeded: num(r.flangesNeeded, "Drum assembly, Flanges needed"), flangesFrom: str(r.flangesFrom), prodOrder: str(r.prodOrder),
      partyCable: str(r.partyCable), lot: str(r.lot), usedOn: parseDay(r.usedOn).day,
    };
  });
}

/** Stock cells the plant has not filled ("", "enter stock", "(shared)") are unknown, not zero. */
export function parseDrumStock(values: unknown[][]): DrumStockRow[] {
  return rows(values, {
    drumSize: h("Drum size"), drums: opt("Current stock"), flangesKgp: opt("Flange stock KHARAGPUR"), flangesPp: opt("Flange stock POLY PARK"),
  })
    .filter((r) => str(r.drumSize) && str(r.drumSize).toUpperCase() !== "TOTAL")
    .map((r) => ({ sizeKey: sizeKey(str(r.drumSize)), drumSize: str(r.drumSize), drums: numOrNull(r.drums), flangesKgp: numOrNull(r.flangesKgp), flangesPp: numOrNull(r.flangesPp) }));
}
