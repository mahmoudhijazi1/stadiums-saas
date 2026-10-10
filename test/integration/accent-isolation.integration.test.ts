import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import { accentCss, accentThemeColor } from "@/lib/accent-css";
import { presetOf } from "@/lib/brand-presets";
import { platformDb } from "@/lib/platform-db";
import { loadBrandIdentity } from "@/modules/platform/application/brand-identity";
import { saveStadiumInfo } from "@/modules/platform/application/stadium-info";
import type { TestFixture } from "./fixtures";
import { seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Per-tenant accent. WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 */
let a: TestFixture;
let b: TestFixture;

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

function actAs(fixture: TestFixture, withSession: boolean) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (withSession) setSessionCookie(fixture.sessionId);
}

const INFO = {
  address: "",
  mapLink: "",
  phone: "",
  whatsappSame: true,
  whatsapp: "",
};

async function choose(fixture: TestFixture, name: string, brandPreset: string) {
  actAs(fixture, true);
  await saveStadiumInfo({ ...INFO, name, brandPreset });
}

/** What the root layout does for a request on this stadium's host. */
async function cssOn(fixture: TestFixture) {
  actAs(fixture, false);
  return accentCss((await currentBrandIdentity())?.preset);
}

describe("the accent follows the host's stadium", () => {
  it("two stadiums with different presets never see each other's colours", async () => {
    await choose(a, "Alpha", "violet");
    await choose(b, "Bravo", "sky");

    const onA = await cssOn(a);
    const onB = await cssOn(b);
    const violet = presetOf("violet");
    const sky = presetOf("sky");

    expect(onA).toBe(accentCss("violet"));
    expect(onB).toBe(accentCss("sky"));
    for (const hex of [violet.light.fill, violet.light.ink, violet.dark.fill]) {
      expect(onA).toContain(hex);
      expect(onB).not.toContain(hex);
    }
    for (const hex of [sky.light.fill, sky.light.ink, sky.dark.fill]) {
      expect(onB).toContain(hex);
      expect(onA).not.toContain(hex);
    }
  });

  it("a stadium that never chose gets the default (lime)", async () => {
    expect(await cssOn(a)).toBe(accentCss("lime"));
  });

  it("an unknown host and a suspended stadium get the default, never the stadium's colour", async () => {
    await choose(a, "Alpha", "pink");
    expect(accentCss((await loadBrandIdentity("no-such-stadium"))?.preset)).toBe(accentCss("lime"));

    await platformDb.tenant.update({ where: { id: a.tenantId }, data: { suspendedAt: new Date() } });
    expect(await cssOn(a)).toBe(accentCss("lime"));
  });

  it("a key stored in the database that is not in the constant reads as the default", async () => {
    await platformDb.tenant.update({
      where: { id: a.tenantId },
      data: { settings: { brandPreset: "</style><script>1</script>" } },
    });
    expect(await cssOn(a)).toBe(accentCss("lime"));
  });

  it("changing the colour changes the CSS and the manifest colour for that stadium only", async () => {
    await choose(a, "Alpha", "indigo");
    await choose(b, "Bravo", "indigo");
    const beforeB = await cssOn(b);

    await choose(a, "Alpha", "fuchsia");
    expect(await cssOn(a)).toBe(accentCss("fuchsia"));
    expect(await cssOn(b)).toBe(beforeB);

    actAs(a, false);
    expect(accentThemeColor((await currentBrandIdentity())?.preset)).toBe(presetOf("fuchsia").dark.fill);
    actAs(b, false);
    expect(accentThemeColor((await currentBrandIdentity())?.preset)).toBe(presetOf("indigo").dark.fill);
  });
});
