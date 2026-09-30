import { describe, expect, it } from "@jest/globals";
import { RESERVED_SLUGS, validateSlug } from "@/modules/platform/domain/slug";

/** Decision 3: 3–30 chars, a-z 0-9 and inner hyphens, not reserved. */
describe("validateSlug", () => {
  it.each([
    ["abc", { ok: true }],
    ["ahmad", { ok: true }],
    ["sami-2", { ok: true }],
    ["a1b", { ok: true }],
    ["x".repeat(30), { ok: true }],
    ["al--nour", { ok: true }],
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
