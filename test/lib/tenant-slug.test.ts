import { describe, expect, it } from "@jest/globals";
import { parseTenantSlug } from "@/lib/tenant-slug";

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
