import { describe, expect, it } from "vitest";
import {
  armouringPending,
  avgPerWorkingDay,
  bobbinPool,
  bobbinTotals,
  dailyOutput,
  lastShiftDays,
  lengthFromTurns,
  shiftDayOf,
  summariseOrders,
  waitingBetween,
  waitingForLaying,
  type OrderLineRow,
} from "../../lib/dashboard/calc";

const line = (o: Partial<OrderLineRow> & Pick<OrderLineRow, "prodOrder" | "stage">): OrderLineRow => ({
  sfgItem: o.stage,
  customer: "ACME",
  cable: "3.5C x 300",
  coresPerCable: null,
  orderedQty: 0,
  doneQty: 0,
  approved: true,
  ...o,
});

describe("shift day (md §7.1)", () => {
  it("07:59 IST belongs to the previous date; 08:00 starts the new one", () => {
    expect(shiftDayOf(new Date("2026-11-18T07:59:00+05:30"))).toBe("2026-11-17");
    expect(shiftDayOf(new Date("2026-11-18T08:00:00+05:30"))).toBe("2026-11-18");
    expect(shiftDayOf(new Date("2026-11-18T23:30:00+05:30"))).toBe("2026-11-18");
  });
  it("lists the last n days oldest first, across a month end", () => {
    expect(lastShiftDays("2026-12-01", 3)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });
});

describe("waiting cable (md §5 blocks 1–5)", () => {
  const orders = summariseOrders([
    line({ prodOrder: "P7-1", stage: "INNER_SHEATH", doneQty: 10 }),
    line({ prodOrder: "P7-1", stage: "ARMOURING", orderedQty: 12, doneQty: 4 }),
    line({ prodOrder: "P7-2", stage: "INNER_SHEATH", doneQty: 3 }),
    line({ prodOrder: "P7-2", stage: "ARMOURING", orderedQty: 3, doneQty: 3, approved: false }),
    // 3 full cores + 1 half core: 30 km full = 10 cable km, 8 km half = 8 cable km → 8
    line({ prodOrder: "P7-3", stage: "INSULATION", sfgItem: "full", coresPerCable: 3, doneQty: 30 }),
    line({ prodOrder: "P7-3", stage: "INSULATION", sfgItem: "half", coresPerCable: 1, doneQty: 8 }),
    line({ prodOrder: "P7-3", stage: "LAYING", doneQty: 5 }),
  ]);

  it("inner done minus armouring done, biggest first, drops zero", () => {
    expect(waitingBetween(orders, "INNER_SHEATH", "ARMOURING").map((r) => [r.prodOrder, r.km])).toEqual([["P7-1", 6]]);
  });
  it("cores waiting for laying use the smallest core line", () => {
    expect(waitingForLaying(orders)).toMatchObject([{ prodOrder: "P7-3", km: 3 }]);
  });
  it("armouring pending carries approval", () => {
    expect(armouringPending(orders)).toMatchObject([{ prodOrder: "P7-1", km: 8, approved: true }]);
  });
});

describe("output", () => {
  const days = ["2026-11-16", "2026-11-17"];
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const out = dailyOutput(
    [
      { shiftDay: d("2026-11-17"), shift: "DAY", qtyM: 5000, isDuplicate: false },
      { shiftDay: d("2026-11-17"), shift: "NIGHT", qtyM: 2000, isDuplicate: false },
      { shiftDay: d("2026-11-17"), shift: "NIGHT", qtyM: 2000, isDuplicate: true },
      { shiftDay: d("2026-11-01"), shift: "DAY", qtyM: 9000, isDuplicate: false },
    ],
    days,
  );
  it("splits day/night, skips duplicates and days outside the window", () => {
    expect(out).toEqual([
      { day: "2026-11-16", dayKm: 0, nightKm: 0, km: 0 },
      { day: "2026-11-17", dayKm: 5, nightKm: 2, km: 7 },
    ]);
  });
  it("average counts only days with production", () => {
    expect(avgPerWorkingDay(out)).toBe(7);
    expect(avgPerWorkingDay([{ km: 0 }])).toBeNull();
  });
});

describe("bobbins (md §6)", () => {
  it("still to wind and extra wound", () => {
    expect(bobbinTotals([{ bobbinsNeeded: 10, bobbinsWound: 4 }, { bobbinsNeeded: 5, bobbinsWound: 7 }])).toEqual({
      toWind: 6,
      extra: 2,
    });
  });
  it("not counted = owned − counted", () => {
    const pool = bobbinPool(
      [
        { state: "filled", count: 40 },
        { state: "empty", count: 100 },
      ],
      145,
    );
    expect(pool.notCounted).toBe(5);
    expect(pool.states[0].state).toBe("empty");
  });
  it("length from turns", () => {
    expect(lengthFromTurns(100, 404, 196)).toBeCloseTo(94.248, 3);
  });
});
