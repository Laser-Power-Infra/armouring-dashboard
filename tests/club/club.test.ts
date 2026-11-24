import { describe, expect, it } from "vitest";
import { bigJump, compareSheet, lotTotals, newOrders, parseFgItem, pendingFrom, refreshOrders, sfgBalances } from "../../lib/club/club";

const line = (prodOrder: string, stage: string, balance: number) => ({ prodOrder, stage, balance });

describe("Club & Run refresh from SFG", () => {
  it("sums open balances per stage and ignores other stages", () => {
    const b = sfgBalances([line("A", "CONDUCTOR", 2.73), line("A", "CONDUCTOR", 0.91), line("A", "FINISH", 0.91), line("A", "TAPING", 5), line("A", "INNER", 0)]);
    expect(b.get("A")).toMatchObject({ conductorBalCoreKm: 3.64, finishBalKm: 0.91, innerBalKm: 0 });
  });

  it("HT orders count only Kharagpur's stages; ACSR's finish balance is its conductor", () => {
    const b = sfgBalances([
      { prodOrder: "H", stage: "INSULATION", balance: 4, fgType: "HT POWER CABLE - ARD" },
      { prodOrder: "H", stage: "ARMOURING", balance: 5, fgType: "HT POWER CABLE - ARD" },
      { prodOrder: "R", stage: "CONDUCTOR", balance: 190, fgType: "7 STRAND" },
    ]);
    expect(b.get("H")).toMatchObject({ insulationBalCoreKm: 4, armouringBalKm: 0 });
    expect(b.get("R")).toMatchObject({ conductorBalCoreKm: 190, finishBalKm: 190 });
  });

  it("names the first stage with work left, or Done", () => {
    expect(pendingFrom({ armouringBalKm: 0.9, finishBalKm: 0.9 })).toBe("Armouring");
    expect(pendingFrom({ finishBalKm: 8.1 })).toBe("Outer");
    expect(pendingFrom({})).toBe("Done");
  });

  it("keeps our figure and parks the SFG one when they differ a lot", () => {
    expect(bigJump(4, 4.5)).toBe(false);
    expect(bigJump(null, 6)).toBe(true);
    const [u] = refreshOrders([{ prodOrder: "A", finishBalKm: 0, armouringBalKm: 1 }], [line("A", "FINISH", 6), line("A", "ARMOURING", 1.2)]);
    expect(u.data.finishBalKm).toBeUndefined();
    expect(u.data.armouringBalKm).toBe(1.2);
    expect(u.data.toConfirm).toEqual({ finishBalKm: 6 });
    expect(u.data.pendingFrom).toBe("Armouring");
  });

  it("an order SFG no longer lists has nothing left", () => {
    const [u] = refreshOrders([{ prodOrder: "A", finishBalKm: 0.9 }], []);
    expect(u.data).toMatchObject({ finishBalKm: 0, pendingFrom: "Done", toConfirm: null });
  });

  it("adds only Kharagpur orders approved in ERP that we do not have, with no lot", () => {
    const o = (prodOrder: string, approved: string) => ({ prodOrder, mcNo: null, party: "X", fgItem: "3.5 CORE X 300 SQ. MM. AL/ARD - WIRE (XLPE)", orderDate: null, approved });
    const added = newOrders([o("P726Y-1", "Yes"), o("P726Y-2", "No"), o("P126Y-3", "Yes"), o("P726Y-4", "Yes"), { ...o("P726Y-5", "Yes"), party: "ABJ SYNDICATES" }], new Set(["P726Y-4"]));
    expect(added).toEqual([expect.objectContaining({ prodOrder: "P726Y-1", cores: 3.5, sizeSqmm: 300, insulation: "XLPE" })]);
    expect(added[0]).not.toHaveProperty("lotNo");
    expect(parseFgItem("ACSR RACCOON")).toEqual({ cores: null, sizeSqmm: null, insulation: null });
  });

  it("totals lots and closes an approved, sent lot with nothing left", () => {
    const lots = [
      { lotNo: "L1", runOrder: 1, approvedByMd: true, sentToPlant: true, status: "Approved" },
      { lotNo: "L2", runOrder: 2, approvedByMd: true, sentToPlant: false, status: "Approved" },
    ];
    const orders = [
      { lotNo: "L1", pendingFrom: "Done", finishBalKm: 0 },
      { lotNo: "L2", pendingFrom: "Outer", finishBalKm: 2.5, conductorBalCoreKm: 1 },
      { lotNo: "L2", pendingFrom: "Done", finishBalKm: 0 },
    ];
    const [l1, l2] = lotTotals(lots, orders);
    expect(l1.data).toMatchObject({ orders: 1, status: "Closed" });
    expect(l2.data).toEqual({ orders: 2, balanceKm: 2.5, conductorPendingCoreKm: 1, insulationPendingCoreKm: 0 });
  });

  it("lists every difference between sheet and dashboard", () => {
    const sheet = { lots: [{ lotNo: "L1", runOrder: 1, approvedByMd: true }, { lotNo: "L9", runOrder: 9, approvedByMd: false }], orders: [{ prodOrder: "A", lotNo: "L1", runOrderInLot: 1, supplyFrom: null, finishBalKm: 2 }] };
    const ours = { lots: [{ lotNo: "L1", runOrder: 2, approvedByMd: true }], orders: [{ prodOrder: "A", lotNo: "L1", runOrderInLot: 1, supplyFrom: null, finishBalKm: 2.01 }, { prodOrder: "B", lotNo: null, runOrderInLot: null, supplyFrom: null }] };
    expect(compareSheet(sheet, ours)).toEqual(["Lot L1 run order: sheet 1, dashboard 2", "Lot L9: in the sheet only", "Order B: in the dashboard only"]);
  });
});
