import { Prisma } from "../generated/prisma/client.ts";

// The whitelist. Table names, column names and SQL sources reach the database only from this file;
// request input is only ever matched against it and bound as values.

export const TABLE_NAMES = ["cable-ready", "wait-inner", "wait-laying", "wait-insulation", "wait-outer", "work-left", "lots", "entries"] as const;
export type TableName = (typeof TABLE_NAMES)[number];

/** text, bool, day: filter dropdown. number, time: sort only (a list of every distinct km filters nothing). */
export type ColumnKind = "text" | "bool" | "day" | "number" | "time";
export const FILTER_KINDS: readonly ColumnKind[] = ["text", "bool", "day"];

export type ColumnDef = {
  /** Also the column's alias in the table's source query. */
  key: string;
  label: string;
  kind: ColumnKind;
  /** Covered by the table's search box. */
  search?: boolean;
  /** One row can hold several values; the source also exposes them as the array "<key>Arr". */
  array?: boolean;
  /** How a number is shown: km with two decimals, a whole number, or bobbins still to wind. */
  format?: "km" | "int" | "toWind";
};

export type TableScope = { machine: string; /** first shift day of the latest-entries window */ since: Date };

export type TableDef = {
  name: TableName;
  title: string;
  unit?: string;
  /** A relation aliased `t` whose columns are the column keys, already limited to this table's fixed scope. */
  source: (scope: TableScope) => Prisma.Sql;
  columns: ColumnDef[];
  /** Order when the reader has not chosen one. Constant SQL. */
  defaultOrder: Prisma.Sql;
  /** The same default as the table header shows it; null when it is not a single visible column. */
  defaultSort: { key: string; dir: "asc" | "desc" } | null;
  /** Appended to every ORDER BY so paging is stable. Constant SQL. */
  tiebreak: Prisma.Sql;
  defaultSize: 5 | 10;
};

const orderColumns: ColumnDef[] = [
  { key: "prodOrder", label: "Order", kind: "text", search: true },
  { key: "customer", label: "Customer", kind: "text", search: true },
  { key: "cable", label: "Cable", kind: "text", search: true },
  { key: "km", label: "km", kind: "number", format: "km" },
];

/** Biggest first in every table (md §7.4). */
const biggestFirst = { defaultOrder: Prisma.sql`"km" DESC`, defaultSort: { key: "km", dir: "desc" }, tiebreak: Prisma.sql`"prodOrder" ASC` } as const;

const waiting = (name: TableName, step: string, title: string, defaultSize: 5 | 10, unit?: string): TableDef => ({
  name,
  title,
  unit,
  source: () => Prisma.sql`(SELECT prod_order AS "prodOrder", customer, cable, km FROM order_waiting WHERE step = ${step}) t`,
  columns: unit ? orderColumns.map((c) => (c.key === "km" ? { ...c, label: unit } : c)) : orderColumns,
  ...biggestFirst,
  defaultSize,
});

export const TABLES: Record<TableName, TableDef> = {
  "cable-ready": waiting("cable-ready", "armouring", "Cable ready for armouring", 10),
  "wait-inner": waiting("wait-inner", "inner", "Waiting for inner sheath", 5),
  "wait-laying": waiting("wait-laying", "laying", "Cores waiting for laying", 5),
  "wait-insulation": waiting("wait-insulation", "insulation", "Conductor waiting for insulation", 5, "core km"),
  "wait-outer": waiting("wait-outer", "outer", "Armoured, waiting for outer sheath", 5),
  "work-left": {
    name: "work-left",
    title: "Work left",
    source: () => Prisma.sql`(SELECT prod_order AS "prodOrder", customer, cable, km, approved, in_plan AS "inPlan" FROM armouring_pending) t`,
    columns: [
      ...orderColumns,
      { key: "approved", label: "Approved", kind: "bool" },
      { key: "inPlan", label: "In plan", kind: "bool" },
    ],
    ...biggestFirst,
    defaultSize: 10,
  },
  lots: {
    name: "lots",
    title: "Lots",
    source: ({ machine }) => Prisma.sql`(
      SELECT lot_no AS "lotNo", cable_item AS "cableItem", armour_type AS "armourType", armour_size AS "armourSize",
             bobbins_needed AS "bobbinsNeeded", bobbins_wound AS "bobbinsWound", bobbins_needed - bobbins_wound AS "balance",
             approved, priority
      FROM lots WHERE machine_code = ${machine} AND NOT completed) t`,
    columns: [
      { key: "lotNo", label: "Lot", kind: "text", search: true },
      { key: "cableItem", label: "Cable", kind: "text", search: true },
      { key: "armourType", label: "Armour", kind: "text", search: true },
      { key: "armourSize", label: "Size", kind: "text", search: true },
      { key: "bobbinsNeeded", label: "Needed", kind: "number", format: "int" },
      { key: "bobbinsWound", label: "Wound", kind: "number", format: "int" },
      { key: "balance", label: "To wind", kind: "number", format: "toWind" },
      { key: "approved", label: "Approved", kind: "bool" },
    ],
    // Job order: the running job first, then the next ones.
    defaultOrder: Prisma.sql`"priority" ASC NULLS LAST`,
    defaultSort: null,
    tiebreak: Prisma.sql`"lotNo" ASC`,
    defaultSize: 10,
  },
  entries: {
    name: "entries",
    title: "Latest production entries",
    source: ({ machine, since }) => Prisma.sql`(
      SELECT id, to_char(shift_day, 'YYYY-MM-DD') AS "shiftDay", shift, entered_at AS "enteredAt",
             array_to_string(prod_orders, ', ') AS "prodOrders", prod_orders AS "prodOrdersArr",
             cable, drum_no AS "drumNo", qty_m AS "qtyM", entered_by AS "enteredBy", is_duplicate AS "isDuplicate"
      FROM production_entries WHERE machine_code = ${machine} AND shift_day >= ${since}) t`,
    columns: [
      { key: "shiftDay", label: "Shift day", kind: "day" },
      { key: "shift", label: "Shift", kind: "text" },
      { key: "enteredAt", label: "Time", kind: "time" },
      // One entry may carry two order numbers: its filter matches either.
      { key: "prodOrders", label: "Order", kind: "text", search: true, array: true },
      { key: "cable", label: "Cable", kind: "text", search: true },
      { key: "drumNo", label: "Drum", kind: "text", search: true },
      { key: "qtyM", label: "Metres", kind: "number", format: "int" },
      { key: "enteredBy", label: "Entered by", kind: "text", search: true },
      { key: "isDuplicate", label: "Duplicate", kind: "bool" },
    ],
    defaultOrder: Prisma.sql`"enteredAt" DESC`,
    defaultSort: { key: "enteredAt", dir: "desc" },
    tiebreak: Prisma.sql`"id" ASC`,
    defaultSize: 10,
  },
};

export const isTableName = (s: string): s is TableName => (TABLE_NAMES as readonly string[]).includes(s);

/** What the browser needs to draw the table. No SQL crosses to the client. */
export type ClientColumn = Pick<ColumnDef, "key" | "label" | "kind" | "format">;
export const clientColumns = (def: TableDef): ClientColumn[] => def.columns.map(({ key, label, kind, format }) => ({ key, label, kind, format }));
