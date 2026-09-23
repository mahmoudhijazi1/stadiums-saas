import { describe, expect, it } from "@jest/globals";
import { parseTenantSlug, resolveRequestHost } from "@/lib/tenant-slug";

describe("parseTenantSlug", () => {
  it("reads the subdomain from a normal host", () => {
    expect(parseTenantSlug("ahmad.stadiums.com")).toBe("ahmad");
    expect(parseTenantSlug("sami.stadiums.com:3000")).toBe("sami");
  });

  it("works with local hosts (lvh.me and *.localhost)", () => {
    expect(parseTenantSlug("ahmad.lvh.me")).toBe("ahmad");
    expect(parseTenantSlug("sami.localhost")).toBe("sami");
  });

  it("returns null when there is no tenant subdomain", () => {
    expect(parseTenantSlug("stadiums.com")).toBeNull();
    expect(parseTenantSlug("www.stadiums.com")).toBeNull();
    expect(parseTenantSlug("localhost")).toBeNull();
    expect(parseTenantSlug("127.0.0.1")).toBeNull();
  });

  it("rejects invalid subdomain slugs on multi-part hosts", () => {
    expect(parseTenantSlug("Bad_Slug.stadiums.com")).toBeNull();
  });
});

describe("resolveRequestHost", () => {
  it("keeps a normal subdomain Host", () => {
    expect(
      resolveRequestHost("ahmad.localhost:3000", "ahmad.localhost:3000"),
    ).toBe("ahmad.localhost:3000");
  });

  it("uses x-forwarded-host when Host collapsed to localhost", () => {
    expect(
      resolveRequestHost("localhost:3000", "ahmad.localhost:3000"),
    ).toBe("ahmad.localhost:3000");
  });

  it("falls back to Origin host when forwarded is missing", () => {
    expect(
      resolveRequestHost("localhost:3000", null, "http://ahmad.localhost:3000"),
    ).toBe("ahmad.localhost:3000");
  });

  it("falls back to Referer host when Origin is missing", () => {
    expect(
      resolveRequestHost(
        "localhost:3000",
        null,
        null,
        "http://ahmad.localhost:3000/owner/login",
      ),
    ).toBe("ahmad.localhost:3000");
  });

  it("uses first forwarded host when a list is present", () => {
    expect(
      resolveRequestHost("127.0.0.1:3000", "sami.localhost:3000, other"),
    ).toBe("sami.localhost:3000");
  });
});
