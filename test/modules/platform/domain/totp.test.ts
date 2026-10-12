import { describe, expect, it } from "@jest/globals";
import { decodeBase32, encodeBase32 } from "@/modules/platform/domain/base32";
import { hotp, otpauthUri, stepAt, totpCode, verifyTotp } from "@/modules/platform/domain/totp";

/** Written, not run. RFC 4226 / 6238 vectors, the window, and the otpauth URI. */
const SECRET = Buffer.from("12345678901234567890", "ascii");

describe("hotp and totpCode", () => {
  it("matches the RFC 6238 SHA-1 vector: T=59 gives 94287082 (8 digits), so 287082 (6 digits)", () => {
    const step = stepAt(59);
    expect(step).toBe(1);
    expect(totpCode(SECRET, step, 8)).toBe("94287082");
    expect(totpCode(SECRET, step)).toBe("287082");
  });

  it("matches the other RFC 6238 SHA-1 vectors", () => {
    const vectors: [number, string][] = [
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
      [20000000000, "65353130"],
    ];
    for (const [seconds, code] of vectors) expect(totpCode(SECRET, stepAt(seconds), 8)).toBe(code);
  });

  it("matches the RFC 4226 HOTP vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => expect(hotp(SECRET, counter)).toBe(code));
  });
});

describe("verifyTotp", () => {
  const now = stepAt(1_700_000_000);

  it("returns the matched step for the current, previous and next step", () => {
    expect(verifyTotp(SECRET, totpCode(SECRET, now), now)).toBe(now);
    expect(verifyTotp(SECRET, totpCode(SECRET, now - 1), now)).toBe(now - 1);
    expect(verifyTotp(SECRET, totpCode(SECRET, now + 1), now)).toBe(now + 1);
  });

  it("refuses a code two steps off, in either direction", () => {
    expect(verifyTotp(SECRET, totpCode(SECRET, now - 2), now)).toBeNull();
    expect(verifyTotp(SECRET, totpCode(SECRET, now + 2), now)).toBeNull();
  });

  it("refuses a wrong code and anything that is not six digits", () => {
    const right = totpCode(SECRET, now);
    const wrong = right === "000000" ? "000001" : "000000";
    expect(verifyTotp(SECRET, wrong, now)).toBeNull();
    for (const bad of ["", "12345", "1234567", "12345a", " 123456", right + " "]) {
      expect(verifyTotp(SECRET, bad, now)).toBeNull();
    }
  });

  it("refuses a code made with another secret", () => {
    const other = Buffer.from("abcdefghijklmnopqrst", "ascii");
    expect(verifyTotp(SECRET, totpCode(other, now), now)).toBeNull();
  });
});

describe("base32", () => {
  it("round-trips bytes and decodes the RFC 4648 vectors", () => {
    expect(encodeBase32(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(Buffer.from(decodeBase32("MZXW6YTBOI")!).toString()).toBe("foobar");
    expect(Buffer.from(decodeBase32("mzxw 6ytb oi======")!).toString()).toBe("foobar");
    const bytes = Uint8Array.from({ length: 20 }, (_, index) => index * 13);
    expect(Array.from(decodeBase32(encodeBase32(bytes))!)).toEqual(Array.from(bytes));
  });

  it("refuses characters outside the alphabet", () => {
    expect(decodeBase32("MZXW6YT1")).toBeNull();
  });
});

describe("otpauthUri", () => {
  it("builds the URI an authenticator reads, issuer lebstads", () => {
    const uri = otpauthUri({ secretBase32: "MZXW6YTBOI", account: "ops.admin" });
    expect(uri.startsWith("otpauth://totp/lebstads:ops.admin?")).toBe(true);
    const query = new URL(uri).searchParams;
    expect(query.get("secret")).toBe("MZXW6YTBOI");
    expect(query.get("issuer")).toBe("lebstads");
    expect(query.get("algorithm")).toBe("SHA1");
    expect(query.get("digits")).toBe("6");
    expect(query.get("period")).toBe("30");
  });
});
