import { describe, expect, it } from "vitest";
import { TABLES } from "../../lib/tables/defs";
import { parseTableParams } from "../../lib/tables/params";

const def = TABLES["work-left"];
const parse = (qs: string) => parseTableParams(def, new URLSearchParams(qs));

describe("table request params", () => {
  it("defaults", () => {
    expect(parse("machine=ARM5")).toEqual({ machine: "ARM5", page: 1, size: 10, sort: null, dir: "desc", q: "", filters: {} });
  });
  it("upstream lists default to 5 rows", () => {
    expect(parseTableParams(TABLES["wait-inner"], new URLSearchParams("machine=ARM5")).size).toBe(5);
  });
  it("repeated f.<col> params; values may contain commas", () => {
    expect(parse("machine=ARM5&f.cable=3C%20x%20240%2C%20AL&f.cable=4C").filters).toEqual({ cable: ["3C x 240, AL", "4C"] });
  });
  it("blank filter value is kept: it means rows with no value", () => {
    expect(parse("machine=ARM5&f.customer=").filters).toEqual({ customer: [""] });
  });
  it("yes/no filters accept only true, false and blank", () => {
    expect(parse("machine=ARM5&f.approved=false").filters).toEqual({ approved: ["false"] });
    expect(parse("machine=ARM5&f.approved=").filters).toEqual({ approved: [""] });
    expect(() => parse("machine=ARM5&f.approved=maybe")).toThrow();
  });
  it.each(["size=1000", "size=7", "page=0", "page=abc", "page=1.5", "sort=password", "dir=up", "f.km=1", "f.nope=x", "q=" + "x".repeat(201)])("rejects %s", (bad) => {
    expect(() => parse("machine=ARM5&" + bad)).toThrow();
  });
  it.each(["", "machine=", "machine=ARM5%27%3B--", "machine=" + "A".repeat(21)])("rejects machine in '%s'", (qs) => {
    expect(() => parse(qs)).toThrow();
  });
  // Postgres refuses a NUL byte in text: stop it here as a bad request, not a server error.
  it.each(["q=a%00b", "f.customer=a%00"])("rejects a NUL byte in %s", (bad) => {
    expect(() => parse("machine=ARM5&" + bad)).toThrow();
  });
  it("trims q", () => {
    expect(parse("machine=ARM5&q=%20tata%20").q).toBe("tata");
  });
  it("accepts a valid sort and direction", () => {
    expect(parse("machine=ARM5&sort=customer&dir=asc&page=3&size=25")).toMatchObject({ sort: "customer", dir: "asc", page: 3, size: 25 });
  });
});
