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
} from "../../lib/dashboard/calc";
import { kgpLines } from "../fixtures/order-lines";


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
  const orders = summariseOrders(kgpLines);

  it("inner done minus armouring done, biggest first, drops zero, negative and under half a metre", () => {
    expect(waitingBetween(orders, "INNER_SHEATH", "ARMOURING").map((r) => [r.prodOrder, r.km])).toEqual([
      ["P7-1", 6],
      ["P7-4", 5],
      ["P7-6", 2],
    ]);
  });
  it("cores waiting for laying use the smallest core line", () => {
    expect(waitingForLaying(orders)).toMatchObject([
      { prodOrder: "P7-3", km: 3 },
      { prodOrder: "P7-8", km: 3 },
    ]);
  });
  it("conductor minus insulation, in core km", () => {
    expect(waitingBetween(orders, "CONDUCTOR", "INSULATION").map((r) => [r.prodOrder, r.km])).toEqual([["P7-8", 8]]);
  });
  it("armouring done minus outer sheath done", () => {
    expect(waitingBetween(orders, "ARMOURING", "OUTER_SHEATH").map((r) => [r.prodOrder, r.km])).toEqual([
      ["P7-1", 3],
      ["P7-2", 3],
      ["P7-5", 1],
      ["P7-7", 1],
    ]);
  });
  it("customer is the first non-empty one", () => {
    expect(orders.find((o) => o.prodOrder === "P7-9")?.customer).toBe("ALPHA");
  });
  it("armouring pending carries approval", () => {
    expect(armouringPending(orders)).toMatchObject([
      { prodOrder: "P7-1", km: 8, approved: true },
      { prodOrder: "P7-7", km: 6, approved: true },
      { prodOrder: "P7-6", km: 4, approved: false, customer: "", cable: "" },
    ]);
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
