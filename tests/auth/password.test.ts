import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../lib/password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("salts: two hashes of the same password differ", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "abcd:")).toBe(false);
    expect(await verifyPassword("x", "abcd:zz")).toBe(false);
  });
});
