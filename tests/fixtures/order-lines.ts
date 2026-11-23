import type { OrderLineRow } from "./order-rules";

export const line = (o: Partial<OrderLineRow> & Pick<OrderLineRow, "prodOrder" | "stage">): OrderLineRow => ({
  sfgItem: o.stage,
  customer: "ACME",
  cable: "3.5C x 300",
  coresPerCable: null,
  orderedQty: 0,
  doneQty: 0,
  approved: true,
  ...o,
});

/** The cable that the database test puts in an open lot. */
export const PLANNED_CABLE = "4C x 185 PLANNED";

/**
 * One set of order lines for both the TypeScript rules and the Postgres views, so the two
 * can be compared row for row. Within an order, lines are in stage order then sfgItem,
 * which is the order the views use to pick the customer and cable.
 */
export const parityLines: OrderLineRow[] = [
  line({ prodOrder: "P7-1", stage: "INNER_SHEATH", doneQty: 10 }),
  line({ prodOrder: "P7-1", stage: "ARMOURING", orderedQty: 12, doneQty: 4 }),
  line({ prodOrder: "P7-1", stage: "OUTER_SHEATH", doneQty: 1 }),
  line({ prodOrder: "P7-2", stage: "INNER_SHEATH", doneQty: 3 }),
  line({ prodOrder: "P7-2", stage: "ARMOURING", orderedQty: 3, doneQty: 3, approved: false }),
  // 3 full cores + 1 half core: 30 km full = 10 cable km, 8 km half = 8 cable km → 8
  line({ prodOrder: "P7-3", stage: "INSULATION", sfgItem: "full", coresPerCable: 3, doneQty: 30 }),
  line({ prodOrder: "P7-3", stage: "INSULATION", sfgItem: "half", coresPerCable: 1, doneQty: 8 }),
  line({ prodOrder: "P7-3", stage: "LAYING", doneQty: 5 }),
  // later step ahead of the earlier one: a negative difference is not "waiting"
  line({ prodOrder: "P7-4", stage: "LAYING", doneQty: 2 }),
  line({ prodOrder: "P7-4", stage: "INNER_SHEATH", doneQty: 5 }),
  // under half a metre counts as nothing
  line({ prodOrder: "P7-5", stage: "INNER_SHEATH", doneQty: 1.0004 }),
  line({ prodOrder: "P7-5", stage: "ARMOURING", orderedQty: 1, doneQty: 1 }),
  // no customer, no cable, not approved
  line({ prodOrder: "P7-6", stage: "INNER_SHEATH", doneQty: 2, customer: null, cable: null, approved: false }),
  line({ prodOrder: "P7-6", stage: "ARMOURING", orderedQty: 4, customer: null, cable: null, approved: false }),
  // mixed approval within one order (any approved line approves it); its cable is in a plan
  line({ prodOrder: "P7-7", stage: "ARMOURING", sfgItem: "a", orderedQty: 5, doneQty: 1, cable: PLANNED_CABLE }),
  line({ prodOrder: "P7-7", stage: "ARMOURING", sfgItem: "b", orderedQty: 2, cable: PLANNED_CABLE, approved: false }),
  // conductor and insulation in core km
  line({ prodOrder: "P7-8", stage: "CONDUCTOR", doneQty: 20 }),
  line({ prodOrder: "P7-8", stage: "INSULATION", coresPerCable: 4, doneQty: 12 }),
  // customer comes from the first line that has one
  line({ prodOrder: "P7-9", stage: "CONDUCTOR", doneQty: 1, customer: null }),
  line({ prodOrder: "P7-9", stage: "INSULATION", sfgItem: "a", doneQty: 0.5, customer: "ALPHA" }),
  line({ prodOrder: "P7-9", stage: "INSULATION", sfgItem: "b", doneQty: 0.5, customer: "ZED" }),
  // another plant: outside the Kharagpur prefix
  line({ prodOrder: "X9-1", stage: "INNER_SHEATH", doneQty: 50 }),
];

export const kgpLines = parityLines.filter((l) => l.prodOrder.startsWith("P7"));
