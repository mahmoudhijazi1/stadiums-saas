import { randomBytes } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import { checkPassword } from "@/modules/access/domain/password-policy";
import {
  OWNER_PASSWORD_ALPHABET,
  OWNER_PASSWORD_LENGTH,
  generateOwnerPassword,
} from "@/modules/platform/domain/owner-password";

/** Written, not run. 16 characters, no look-alikes, always within the shared password policy. */
const context = { identifier: "owner@al-nour", slug: "al-nour" };

describe("generateOwnerPassword", () => {
  it("is 16 characters, only from the alphabet, and passes the shared policy, over many runs", () => {
    expect(OWNER_PASSWORD_LENGTH).toBe(16);
    const seen = new Set<string>();
    for (let run = 0; run < 2000; run += 1) {
      const password = generateOwnerPassword((size) => randomBytes(size), context);
      expect(password).toHaveLength(16);
      expect([...password].every((char) => OWNER_PASSWORD_ALPHABET.includes(char))).toBe(true);
      expect(checkPassword(password, context)).toBeNull();
      seen.add(password);
    }
    expect(seen.size).toBe(2000); // no repeats
  });

  it("has no look-alike characters in its alphabet (I O l o 0 1)", () => {
    for (const char of "IOlo01") expect(OWNER_PASSWORD_ALPHABET).not.toContain(char);
    expect(OWNER_PASSWORD_ALPHABET).toHaveLength(56);
    expect(new Set(OWNER_PASSWORD_ALPHABET).size).toBe(56);
  });

  it("skips bytes that would make some characters likelier (rejection sampling)", () => {
    // Each call: the first half is 255 (always skipped), the second half is 0 (always "A").
    const fake = (size: number) => Uint8Array.from({ length: size }, (_, index) => (index < size / 2 ? 255 : 0));
    expect(generateOwnerPassword(fake, context)).toBe("A".repeat(16));
  });
});
