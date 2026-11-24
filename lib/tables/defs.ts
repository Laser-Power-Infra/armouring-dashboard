import { Prisma } from "../generated/prisma/client.ts";
import { SUPPLY_FROM } from "../club/club.ts";

// The whitelist. Table names, column names and SQL sources reach the database only from this file;
// request input is only ever matched against it and bound as values.

export const TABLE_NAMES = ["cable-ready", "wait-inner", "wait-laying", "wait-insulation", "wait-outer", "work-left", "lots", "entries", "club-lots", "club-orders"] as const;
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
  /** Editable by an admin through a dropdown of these values (a bool column: "true" / "false"). */
  edit?: readonly string[];
};

const YES_NO_EDIT = ["true", "false"] as const;

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
  // Club & Run sheet as stored by the cards sync. Plant-wide: the machine scope is not used.
  "club-lots": {
    name: "club-lots",
    title: "Club & Run – Lots",
    source: () => Prisma.sql`(
      SELECT run_order AS "runOrder", lot_no AS "lotNo", what_clubbed AS "whatClubbed", to_char(created, 'YYYY-MM-DD') AS "created",
             orders, balance_km AS "balanceKm", conductor_pending_core_km AS "conductorPending", insulation_pending_core_km AS "insulationPending",
             approved_by_md AS "approvedByMd", sent_to_plant AS "sentToPlant", status, remarks
      FROM kgp_lots) t`,
    columns: [
      { key: "runOrder", label: "Run order", kind: "number", format: "int" },
      { key: "lotNo", label: "Lot", kind: "text", search: true },
      { key: "whatClubbed", label: "What is clubbed", kind: "text", search: true },
      { key: "created", label: "Created", kind: "day" },
      { key: "orders", label: "Orders", kind: "number", format: "int" },
      { key: "balanceKm", label: "Balance to finish km", kind: "number", format: "km" },
      { key: "conductorPending", label: "Conductor pending core km", kind: "number", format: "km" },
      { key: "insulationPending", label: "Insulation pending core km", kind: "number", format: "km" },
      { key: "approvedByMd", label: "Approved by MD", kind: "bool", edit: YES_NO_EDIT },
      { key: "sentToPlant", label: "Sent to plant", kind: "bool", edit: YES_NO_EDIT },
      { key: "status", label: "Status", kind: "text" },
      { key: "remarks", label: "Remarks", kind: "text", search: true },
    ],
    defaultOrder: Prisma.sql`"runOrder" ASC`,
    defaultSort: { key: "runOrder", dir: "asc" },
    tiebreak: Prisma.sql`"lotNo" ASC`,
    defaultSize: 10,
  },
  "club-orders": {
    name: "club-orders",
    title: "Club & Run – Orders",
    source: () => Prisma.sql`(
      SELECT prod_order AS "prodOrder", mc_no AS "mcNo", party, cable, size_sqmm AS "sizeSqmm", cores, armour, insulation,
             to_char(order_date, 'YYYY-MM-DD') AS "orderDate", approved,
             conductor_bal_core_km AS "conductorBal", insulation_bal_core_km AS "insulationBal", laying_bal_km AS "layingBal",
             inner_bal_km AS "innerBal", armouring_bal_km AS "armouringBal", finish_bal_km AS "finishBal",
             pending_from AS "pendingFrom", lot_no AS "lotNo", run_order_in_lot AS "runOrderInLot", remarks,
             supply_from AS "supplyFrom", suggested_lot AS "suggestedLot", to_confirm::text AS "toConfirm",
             on_hold AS "onHold", urgent, to_char(customer_date, 'YYYY-MM-DD') AS "customerDate", to_char(promised_on, 'YYYY-MM-DD') AS "promisedOn"
      FROM kgp_orders) t`,
    columns: [
      { key: "prodOrder", label: "Order", kind: "text", search: true },
      { key: "mcNo", label: "MC no", kind: "text", search: true },
      { key: "party", label: "Party", kind: "text", search: true },
      { key: "cable", label: "Cable", kind: "text", search: true },
      { key: "sizeSqmm", label: "Size sq mm", kind: "number" },
      { key: "cores", label: "Cores", kind: "number" },
      { key: "armour", label: "Armour", kind: "text" },
      { key: "insulation", label: "Insulation", kind: "text" },
      { key: "orderDate", label: "Order date", kind: "day" },
      { key: "approved", label: "Approved", kind: "text" },
      { key: "conductorBal", label: "Conductor bal core km", kind: "number", format: "km" },
      { key: "insulationBal", label: "Insulation bal core km", kind: "number", format: "km" },
      { key: "layingBal", label: "Laying bal km", kind: "number", format: "km" },
      { key: "innerBal", label: "Inner bal km", kind: "number", format: "km" },
      { key: "armouringBal", label: "Armouring bal km", kind: "number", format: "km" },
      { key: "finishBal", label: "Finish bal km", kind: "number", format: "km" },
      { key: "pendingFrom", label: "Pending from", kind: "text" },
      { key: "lotNo", label: "Lot", kind: "text", search: true },
      { key: "runOrderInLot", label: "Run order", kind: "number", format: "int" },
      { key: "remarks", label: "Remarks", kind: "text", search: true },
      { key: "supplyFrom", label: "Supply from", kind: "text", edit: SUPPLY_FROM },
      { key: "suggestedLot", label: "Suggested lot", kind: "text", search: true },
      { key: "toConfirm", label: "To confirm (SFG figures)", kind: "text" },
      { key: "onHold", label: "On hold", kind: "bool" },
      { key: "urgent", label: "Urgent", kind: "bool" },
      { key: "customerDate", label: "Customer date", kind: "day" },
      { key: "promisedOn", label: "Promised FG", kind: "day" },
    ],
    defaultOrder: Prisma.sql`"lotNo" ASC NULLS LAST, "runOrderInLot" ASC NULLS LAST`,
    defaultSort: null,
    tiebreak: Prisma.sql`"prodOrder" ASC`,
    defaultSize: 10,
  },
};

export const isTableName = (s: string): s is TableName => (TABLE_NAMES as readonly string[]).includes(s);

/** What the browser needs to draw the table. No SQL crosses to the client. */
export type ClientColumn = Pick<ColumnDef, "key" | "label" | "kind" | "format" | "edit">;
export const clientColumns = (def: TableDef): ClientColumn[] => def.columns.map(({ key, label, kind, format, edit }) => ({ key, label, kind, format, edit }));
