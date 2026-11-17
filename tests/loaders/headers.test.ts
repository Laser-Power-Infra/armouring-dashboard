import { describe, expect, it } from "vitest";
import { mapRows, MissingHeaderError } from "../../lib/sheets/headers";

const fields = {
  sl: { headers: ["Sl"] },
  status: { headers: ["Bobbin Status", "Status"] },
  count: { headers: ["No. of bobbins"] },
  note: { headers: ["Note"], optional: true },
};

describe("mapRows", () => {
  it("maps by header name with shuffled columns, aliases and messy spacing", () => {
    const rows = mapRows(
      [
        ["  no. of  BOBBINS ", "Sl", "status"],
        [12, 1, "Loaded"],
      ],
      fields,
    );
    expect(rows).toEqual([{ sl: 1, status: "Loaded", count: 12 }]);
  });

  it("errors on a missing required header", () => {
    expect(() => mapRows([["Sl", "Status"]], fields)).toThrow(MissingHeaderError);
  });

  it("skips blank rows and turns empty strings into null", () => {
    const rows = mapRows(
      [
        ["Sl", "Status", "No. of bobbins"],
        ["", " ", ""],
        [],
        [2, "", 5],
      ],
      fields,
    );
    expect(rows).toEqual([{ sl: 2, status: null, count: 5 }]);
  });
});
