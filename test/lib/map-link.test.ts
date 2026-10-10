import { describe, expect, it } from "@jest/globals";
import { isAllowedMapLink, MAP_LINK_HOSTS } from "@/lib/map-link";

/** Written, not run when authored. Stadium info: the map link rule. */
describe("isAllowedMapLink", () => {
  it.each([
    "https://google.com/maps/place/Ahmad+Stadium/@33.89,35.5,17z",
    "https://www.google.com/maps?q=33.89,35.5",
    "https://maps.google.com/?q=33.89,35.5",
    "https://maps.google.com",
    "https://maps.app.goo.gl/AbCdEf123",
    "https://goo.gl/maps/AbCdEf123",
  ])("accepts %s", (url) => {
    expect(isAllowedMapLink(url)).toBe(true);
  });

  it.each([
    ["http, not https", "http://google.com/maps/place/x"],
    ["a lookalike host", "https://google.com.evil.com/maps/place/x"],
    ["a lookalike prefix", "https://evilgoogle.com/maps/place/x"],
    ["the host only in the path", "https://evil.com/google.com/maps"],
    ["the host in the user part", "https://google.com@evil.com/maps"],
    ["a lookalike subdomain", "https://maps.google.com.evil.com/"],
    ["google.com but not under /maps", "https://google.com/search?q=x"],
    ["a path that only starts with maps", "https://google.com/mapsx"],
    ["goo.gl outside /maps", "https://goo.gl/AbCdEf"],
    ["credentials", "https://user:pass@google.com/maps"],
    ["a port", "https://google.com:8443/maps"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>1</script>"],
    ["not a URL", "google maps please"],
    ["empty", ""],
    ["whitespace only", "   "],
    ["an overlong value", `https://google.com/maps/${"a".repeat(400)}`],
  ])("refuses %s", (_label, url) => {
    expect(isAllowedMapLink(url)).toBe(false);
  });

  it("is one constant: every listed host is exact, with no wildcard", () => {
    for (const rule of MAP_LINK_HOSTS) {
      expect(rule.host).not.toContain("*");
      expect(rule.host).not.toContain("/");
    }
  });
});
