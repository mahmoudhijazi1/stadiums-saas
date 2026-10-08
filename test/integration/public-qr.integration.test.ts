/** @jest-environment node */
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { GET } from "@/app/owner/qr/route";
import { platformDb } from "@/lib/platform-db";
import { publicPageUrl } from "@/lib/public-page-url";
import { qrSvg } from "@/lib/qr";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * GET /owner/qr: the QR of the tenant's public page. The text encoded is publicPageUrl(slug)
 * for the tenant the HOST names; nothing in the query can change it. (A QR is deterministic, so
 * comparing the SVG with qrSvg(canonical URL) proves the text exactly; one PNG is decoded with a
 * real reader, because a 1024 px PNG takes about 10 s to render under Jest.)
 */
let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
});

function actAs(token: string | null, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  if (token) setSessionCookie(token);
}

const request = (query = "") => new Request(`https://${fixture.tenantSlug}.lebstads.test/owner/qr${query}`);

describe("GET /owner/qr", () => {
  it("refuses an anonymous request", async () => {
    actAs(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves an SVG by default to any role, even a staff member with no permissions", async () => {
    actAs(await createStaffSession(fixture.tenantId, {}));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toBeNull();
    const url = publicPageUrl(fixture.tenantSlug);
    expect(url).toBe(`http://${fixture.tenantSlug}.lebstads.test/`);
    expect(await response.text()).toBe(await qrSvg(url));
  });

  it("encodes the host's tenant and only that: another stadium has a different code", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(fixture.sessionId);
    const mine = await (await GET(request())).text();
    actAs(other.sessionId, "sami");
    const theirs = await (await GET(new Request("https://sami.lebstads.test/owner/qr"))).text();

    expect(mine).toBe(await qrSvg("http://test-stadium.lebstads.test/"));
    expect(theirs).toBe(await qrSvg("http://sami.lebstads.test/"));
    expect(theirs).not.toBe(mine);
  });

  it("cannot be steered by the query string", async () => {
    const expected = await qrSvg(publicPageUrl(fixture.tenantSlug));
    for (const query of [
      "?url=https://evil.example/",
      "?slug=sami&tenant=sami&host=evil.example",
      "?text=hello&format=svg&data=x",
      "?format=%00",
    ]) {
      const response = await GET(request(query));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(expected);
    }
  });

  it("refuses a suspended tenant", async () => {
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.sessionId);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "tenant_suspended" });
  });

  it("serves the PNG as an attachment named after the slug, 1024 px, decoding to the canonical URL", async () => {
    const response = await GET(request("?format=png"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${fixture.tenantSlug}-qr.png"`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    expect([png.width, png.height]).toEqual([1024, 1024]);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(publicPageUrl(fixture.tenantSlug));
  }, 60000);
});
