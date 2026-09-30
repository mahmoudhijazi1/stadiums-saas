import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it } from "@jest/globals";
import {
  DEFAULT_PASSWORD_HASH_COST,
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "@/modules/access/infrastructure/password";

/**
 * Hash cost: scrypt N = 2^cost, default measured for about 250 ms on the build
 * machine, overridable with PASSWORD_HASH_COST. The stored hash carries its
 * parameters so older hashes still verify and are upgraded on login.
 */
afterEach(() => {
  delete process.env.PASSWORD_HASH_COST;
});

/** A hash in the old format: salt:hex, Node's default scrypt cost (N = 2^14). */
function legacyHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

describe("password hashing", () => {
  it("defaults to cost 16 (N = 65536) and records it in the hash", async () => {
    expect(DEFAULT_PASSWORD_HASH_COST).toBe(16);
    const stored = await hashPassword("a long enough password");
    expect(stored).toMatch(/^scrypt:16:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword("a long enough password", stored)).toBe(true);
    expect(await verifyPassword("another password", stored)).toBe(false);
  });

  it("uses PASSWORD_HASH_COST when set", async () => {
    process.env.PASSWORD_HASH_COST = "14";
    const stored = await hashPassword("pw-with-lower-cost");
    expect(stored.startsWith("scrypt:14:8:1:")).toBe(true);
    expect(await verifyPassword("pw-with-lower-cost", stored)).toBe(true);
  });

  it("refuses a PASSWORD_HASH_COST outside 14..20 or not an integer", async () => {
    for (const bad of ["13", "21", "abc", "15.5", ""]) {
      process.env.PASSWORD_HASH_COST = bad;
      await expect(hashPassword("x")).rejects.toThrow(/PASSWORD_HASH_COST/);
    }
  });

  it("still verifies old salt:hex hashes", async () => {
    const stored = legacyHash("old password");
    expect(await verifyPassword("old password", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("rejects malformed hashes without throwing", async () => {
    for (const bad of ["", "nocolon", "scrypt:16:8:1:abc", "scrypt:99:8:1:aa:bb", "scrypt:x:8:1:aa:bb"]) {
      expect(await verifyPassword("x", bad)).toBe(false);
    }
  });

  it("needs a rehash when the stored parameters differ from the current cost", async () => {
    expect(passwordNeedsRehash(legacyHash("x"))).toBe(true);
    expect(passwordNeedsRehash(await hashPassword("x"))).toBe(false);
    process.env.PASSWORD_HASH_COST = "14";
    const lower = await hashPassword("x");
    delete process.env.PASSWORD_HASH_COST;
    expect(passwordNeedsRehash(lower)).toBe(true);
  });
});
