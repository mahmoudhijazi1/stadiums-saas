import { createHash } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import {
  hashSessionToken,
  newSessionToken,
} from "@/modules/access/infrastructure/session-token";

/** Security audit S-2: 256-bit random tokens, only their SHA-256 is stored. */
describe("session tokens", () => {
  it("is 32 random bytes as base64url", () => {
    const token = newSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => newSessionToken()));
    expect(seen.size).toBe(1000);
  });

  it("hashes to the hex SHA-256 of the token", () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
