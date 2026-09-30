import { describe, expect, it } from "@jest/globals";
import { parseLoginIdentifier } from "@/modules/access/domain/identifier";
import { RESERVED_SLUGS, SLUG_MAX, SLUG_MIN, validateSlug } from "@/modules/platform/domain/slug";

/**
 * Decision 3: 3–30 chars, a-z 0-9 and single inner hyphens, not reserved, no
 * punycode (xn--). Consecutive hyphens are refused so owner@<slug> is always a
 * valid login identifier (step-0 conflict, resolved by the user).
 */
describe("validateSlug", () => {
  it.each([
    ["abc", { ok: true }],
    ["ahmad", { ok: true }],
    ["sami-2", { ok: true }],
    ["a1b", { ok: true }],
    ["x".repeat(30), { ok: true }],
    ["al--nour", { ok: false, reason: "format" }],
    ["xn--abc", { ok: false, reason: "punycode" }],
    ["xn--80ak6aa92e", { ok: false, reason: "punycode" }],
    ["xnab", { ok: true }],
    ["ab", { ok: false, reason: "length" }],
    ["x".repeat(31), { ok: false, reason: "length" }],
    ["", { ok: false, reason: "length" }],
    ["-abc", { ok: false, reason: "format" }],
    ["abc-", { ok: false, reason: "format" }],
    ["Ahmad", { ok: false, reason: "format" }],
    ["ah_mad", { ok: false, reason: "format" }],
    ["ah.mad", { ok: false, reason: "format" }],
    ["ahmad ", { ok: false, reason: "format" }],
    ["أحمد", { ok: false, reason: "format" }],
    ["www", { ok: false, reason: "reserved" }],
    ["mail", { ok: false, reason: "reserved" }],
    ["admin", { ok: false, reason: "reserved" }],
    ["test", { ok: false, reason: "reserved" }],
  ])("%j → %j", (slug, expected) => {
    expect(validateSlug(slug)).toEqual(expected);
  });

  it("reserves exactly the listed names", () => {
    expect([...RESERVED_SLUGS].sort()).toEqual(
      [
        "www", "mail", "webmail", "ftp", "smtp", "imap", "pop", "ns1", "ns2", "admin", "api", "app",
        "static", "assets", "cdn", "status", "support", "help", "dashboard", "login", "panel", "cpanel", "test",
      ].sort(),
    );
    for (const slug of RESERVED_SLUGS) {
      expect(validateSlug(slug)).toEqual(
        slug.length < 3 ? { ok: false, reason: "length" } : { ok: false, reason: "reserved" },
      );
    }
  });
});

describe("validateSlug and the login identifier cannot drift apart", () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  function candidates(): string[] {
    const out = new Set<string>(["abc", "a1b", "1ab", "123", "a-b", "a-b-c", "0-9", "x".repeat(SLUG_MAX)]);
    for (const length of [SLUG_MIN, SLUG_MIN + 1, SLUG_MAX - 1, SLUG_MAX]) {
      for (let seed = 0; seed < 200; seed += 1) {
        let slug = "";
        for (let i = 0; i < length; i += 1) {
          const inner = i > 0 && i < length - 1 && (seed + i) % 4 === 0;
          slug += inner ? "-" : alphabet[(seed * 7 + i * 13) % alphabet.length];
        }
        out.add(slug);
        out.add(`${(seed % 10).toString()}${slug.slice(1)}`); // leading digit
      }
    }
    return [...out];
  }

  it("every accepted slug gives a valid default owner identifier owner@<slug>", () => {
    let accepted = 0;
    const broken: string[] = [];
    for (const slug of candidates()) {
      if (!validateSlug(slug).ok) continue;
      accepted += 1;
      const parsed = parseLoginIdentifier(`owner@${slug}`);
      if (!parsed || parsed.slug !== slug) broken.push(slug);
    }
    expect(broken).toEqual([]);
    expect(accepted).toBeGreaterThan(500);
  });
});
