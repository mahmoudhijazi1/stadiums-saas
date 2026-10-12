import { randomBytes } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import { decodeBase32 } from "@/modules/platform/domain/base32";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  loadTotpKey,
  newTotpSecretBase32,
} from "@/modules/platform/infrastructure/totp-crypto";

/** Written, not run. AES-256-GCM at rest, the key from the environment, and the new secret. */
const KEY = randomBytes(32);
const SECRET = "MZXW6YTBOI4TQMZR";

describe("encryptTotpSecret / decryptTotpSecret", () => {
  it("round-trips, and the stored value is not the secret and differs each time", () => {
    const first = encryptTotpSecret(SECRET, KEY, "admin-1");
    expect(decryptTotpSecret(first, KEY, "admin-1")).toBe(SECRET);
    expect(first).not.toContain(SECRET);
    expect(encryptTotpSecret(SECRET, KEY, "admin-1")).not.toBe(first);
  });

  it("fails on a tampered ciphertext, tag or iv", () => {
    const [version, iv, tag, body] = encryptTotpSecret(SECRET, KEY, "admin-1").split(".");
    const flip = (part: string) => (part[0] === "A" ? "B" : "A") + part.slice(1);
    expect(() => decryptTotpSecret([version, iv, tag, flip(body!)].join("."), KEY, "admin-1")).toThrow();
    expect(() => decryptTotpSecret([version, iv, flip(tag!), body].join("."), KEY, "admin-1")).toThrow();
    expect(() => decryptTotpSecret([version, flip(iv!), tag, body].join("."), KEY, "admin-1")).toThrow();
    expect(() => decryptTotpSecret("garbage", KEY, "admin-1")).toThrow();
  });

  it("fails under a wrong key and for another row's id", () => {
    const stored = encryptTotpSecret(SECRET, KEY, "admin-1");
    expect(() => decryptTotpSecret(stored, randomBytes(32), "admin-1")).toThrow();
    expect(() => decryptTotpSecret(stored, KEY, "admin-2")).toThrow();
  });
});

describe("loadTotpKey", () => {
  it("reads 32 bytes of base64", () => {
    expect(loadTotpKey({ PLATFORM_TOTP_KEY: KEY.toString("base64") }).equals(KEY)).toBe(true);
  });

  it("throws when missing or the wrong length, naming the variable and never its value", () => {
    expect(() => loadTotpKey({})).toThrow(/PLATFORM_TOTP_KEY/);
    const short = randomBytes(16).toString("base64");
    let message = "";
    try {
      loadTotpKey({ PLATFORM_TOTP_KEY: short });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/PLATFORM_TOTP_KEY/);
    expect(message).not.toContain(short);
  });
});

describe("newTotpSecretBase32", () => {
  it("is 20 random bytes as base32 (32 characters), different each time", () => {
    const secret = newTotpSecretBase32();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(decodeBase32(secret)).toHaveLength(20);
    expect(newTotpSecretBase32()).not.toBe(secret);
  });
});
