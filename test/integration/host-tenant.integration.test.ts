import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { getCurrentTenant } from "@/lib/tenant-context";
import type { TestFixture } from "./fixtures";
import { seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setRequestHeader } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Security audit S-9: the tenant comes from the validated Host only. A
 * client-supplied x-tenant-slug is never read, including on paths the proxy
 * matcher skips (the proxy never ran, so nothing stripped the header).
 */
let a: TestFixture;
let b: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
  clearRequestStubs();
});

async function tenantOrNotFound(): Promise<string> {
  try {
    return (await getCurrentTenant()).slug;
  } catch (error) {
    return (error as { digest?: string }).digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")
      ? "404"
      : String(error);
  }
}

describe("tenant from Host only", () => {
  it("ignores x-tenant-slug when Host names another tenant", async () => {
    setRequestHeader("host", `${a.tenantSlug}.lebstads.test`);
    setRequestHeader("x-tenant-slug", b.tenantSlug);
    expect(await tenantOrNotFound()).toBe(a.tenantSlug);
  });

  it("404 for a foreign host even with a valid x-tenant-slug", async () => {
    setRequestHeader("host", `${a.tenantSlug}.attacker.example`);
    setRequestHeader("x-tenant-slug", a.tenantSlug);
    expect(await tenantOrNotFound()).toBe("404");
  });

  it("404 on the bare domain even with x-tenant-slug", async () => {
    setRequestHeader("host", "lebstads.test");
    setRequestHeader("x-tenant-slug", a.tenantSlug);
    expect(await tenantOrNotFound()).toBe("404");
  });

  it("404 for an unknown subdomain", async () => {
    setRequestHeader("host", "nobody.lebstads.test");
    expect(await tenantOrNotFound()).toBe("404");
  });
});
