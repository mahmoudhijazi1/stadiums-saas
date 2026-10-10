import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import { brandVersion } from "@/lib/brand-identity";
import { platformDb } from "@/lib/platform-db";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { loadBrandIdentity } from "@/modules/platform/application/brand-identity";
import { loadStadiumInfo, saveStadiumInfo } from "@/modules/platform/application/stadium-info";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Stadium info and the generated logo. WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 */
let a: TestFixture;
let b: TestFixture;

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
  actAs(a, a.sessionId);
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

function actAs(fixture: TestFixture, token?: string) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (token) setSessionCookie(token);
}

const INFO = {
  name: "ملعب النور",
  address: "Hamra, Beirut",
  mapLink: "https://maps.app.goo.gl/AbCdEf123",
  phone: "03 123 456",
  whatsappSame: false,
  whatsapp: "71 123 456",
  brandPreset: "blue",
};

async function tenantRow(id: string) {
  return platformDb.tenant.findUniqueOrThrow({ where: { id } });
}

describe("saveStadiumInfo", () => {
  it("saves the info and the name for this stadium, and writes one tenant.rename audit row", async () => {
    await saveStadiumInfo(INFO);

    const row = await tenantRow(a.tenantId);
    expect(row.name).toBe("ملعب النور");
    expect(row.slug).toBe(a.tenantSlug);
    expect(parseTenantSettings(row.settings)).toMatchObject({
      address: "Hamra, Beirut",
      mapLink: "https://maps.app.goo.gl/AbCdEf123",
      phone: "03123456",
      whatsappSame: false,
      whatsapp: "71123456",
      brandPreset: "blue",
      // The other settings are untouched.
      timeDisplay: "h23",
      perPlayerSplitEnabled: true,
    });

    const audit = await platformDb.platformAuditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "tenant.rename",
      tenantId: a.tenantId,
      actor: `owner:${a.ownerUserId}`,
      detail: { from: "Test Stadium", to: "ملعب النور" },
    });
  });

  it("only ever touches the current stadium: another stadium's name, slug and settings do not change", async () => {
    const before = await tenantRow(b.tenantId);
    await saveStadiumInfo(INFO);
    const after = await tenantRow(b.tenantId);
    expect(after.name).toBe(before.name);
    expect(after.slug).toBe(before.slug);
    expect(after.settings).toEqual(before.settings);
    expect(await platformDb.platformAuditLog.count({ where: { tenantId: b.tenantId } })).toBe(0);
  });

  it("the stadium is the Host's: the same call on the other host changes the other stadium", async () => {
    actAs(b, b.sessionId);
    await saveStadiumInfo({ ...INFO, name: "Second" });
    expect((await tenantRow(b.tenantId)).name).toBe("Second");
    expect((await tenantRow(a.tenantId)).name).toBe("Test Stadium");
  });

  it("takes no tenant id and no slug from the input", async () => {
    await expect(saveStadiumInfo({ ...INFO, tenantId: b.tenantId })).rejects.toMatchObject({ key: "form.invalid" });
    await expect(saveStadiumInfo({ ...INFO, slug: "changed" })).rejects.toMatchObject({ key: "form.invalid" });
    expect((await tenantRow(a.tenantId)).slug).toBe(a.tenantSlug);
    expect((await tenantRow(b.tenantId)).name).toBe("Other Stadium");
    expect(await platformDb.platformAuditLog.count()).toBe(0);
  });

  it("writes no audit row when the name did not change, but still saves the info", async () => {
    await saveStadiumInfo({ ...INFO, name: "Test Stadium" });
    expect(await platformDb.platformAuditLog.count()).toBe(0);
    expect(parseTenantSettings((await tenantRow(a.tenantId)).settings).address).toBe("Hamra, Beirut");
  });

  it("cleans the name and refuses a bad map link or phone without writing anything", async () => {
    await saveStadiumInfo({ ...INFO, name: "  Al​  Nour  " });
    expect((await tenantRow(a.tenantId)).name).toBe("Al Nour");

    const settingsBefore = (await tenantRow(a.tenantId)).settings;
    await expect(saveStadiumInfo({ ...INFO, mapLink: "https://google.com.evil.com/maps/x" })).rejects.toMatchObject({
      key: "stadium.map_invalid",
    });
    await expect(saveStadiumInfo({ ...INFO, phone: "03abc" })).rejects.toMatchObject({ key: "stadium.phone_invalid" });
    await expect(saveStadiumInfo({ ...INFO, name: "x".repeat(61) })).rejects.toMatchObject({ key: "stadium.name_invalid" });
    expect((await tenantRow(a.tenantId)).settings).toEqual(settingsBefore);
  });

  it("needs settings.manage: staff without it (or with other flags) are refused, with nothing written", async () => {
    const flagSets: Record<string, true>[] = [{}, { "bookings.create": true }, { "reports.view": true }];
    for (const flags of flagSets) {
      actAs(a, await createStaffSession(a.tenantId, flags));
      await expect(saveStadiumInfo(INFO)).rejects.toMatchObject({ key: "access.not_allowed" });
      await expect(loadStadiumInfo()).rejects.toMatchObject({ key: "access.not_allowed" });
    }
    expect((await tenantRow(a.tenantId)).name).toBe("Test Stadium");
    expect(await platformDb.platformAuditLog.count()).toBe(0);
  });

  it("staff with settings.manage may save", async () => {
    actAs(a, await createStaffSession(a.tenantId, { "settings.manage": true }));
    await saveStadiumInfo(INFO);
    expect((await tenantRow(a.tenantId)).name).toBe("ملعب النور");
  });

  it("an unauthenticated call is refused", async () => {
    actAs(a);
    await expect(saveStadiumInfo(INFO)).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("another stadium's owner cannot save here (their session is not a member of this host)", async () => {
    actAs(a, b.sessionId);
    await expect(saveStadiumInfo(INFO)).rejects.toMatchObject({ key: "access.not_allowed" });
    expect((await tenantRow(a.tenantId)).name).toBe("Test Stadium");
  });

  it("a suspended stadium cannot save", async () => {
    await platformDb.tenant.update({ where: { id: a.tenantId }, data: { suspendedAt: new Date() } });
    await expect(saveStadiumInfo(INFO)).rejects.toBeDefined();
    expect((await tenantRow(a.tenantId)).name).toBe("Test Stadium");
  });

  it("loadStadiumInfo returns what was saved", async () => {
    await saveStadiumInfo(INFO);
    expect(await loadStadiumInfo()).toEqual({
      name: "ملعب النور",
      address: "Hamra, Beirut",
      mapLink: "https://maps.app.goo.gl/AbCdEf123",
      phone: "03123456",
      whatsappSame: false,
      whatsapp: "71123456",
      brandPreset: "blue",
    });
  });
});

describe("the logo identity of a host", () => {
  it("is the symbol and the preset key of this stadium, and not its name", async () => {
    await saveStadiumInfo({ ...INFO, name: "Ahmad Stadium", brandPreset: "red" });
    const identity = await loadBrandIdentity(a.tenantSlug);
    expect(identity).toEqual({ symbol: "A", preset: "red" });
    expect(JSON.stringify(identity)).not.toContain("Ahmad Stadium");
    expect(Object.keys(identity!).sort()).toEqual(["preset", "symbol"]);
  });

  it("follows the first grapheme for Arabic, digits and emoji names", async () => {
    await saveStadiumInfo({ ...INFO, name: "ملعب النور" });
    expect((await loadBrandIdentity(a.tenantSlug))!.symbol).toBe("م");
    await saveStadiumInfo({ ...INFO, name: "7 Stars" });
    expect((await loadBrandIdentity(a.tenantSlug))!.symbol).toBe("7");
    await saveStadiumInfo({ ...INFO, name: "⚽ Goal" });
    expect((await loadBrandIdentity(a.tenantSlug))!.symbol).toBe("•");
  });

  it("is neutral (null) for an unknown host and for a suspended stadium", async () => {
    expect(await loadBrandIdentity("no-such-stadium")).toBeNull();
    await platformDb.tenant.update({ where: { id: a.tenantId }, data: { suspendedAt: new Date() } });
    expect(await loadBrandIdentity(a.tenantSlug)).toBeNull();
    // The other stadium is unaffected.
    expect(await loadBrandIdentity(b.tenantSlug)).not.toBeNull();
  });

  it("another stadium's host never returns this stadium's identity", async () => {
    await saveStadiumInfo({ ...INFO, name: "Alpha", brandPreset: "red" });
    actAs(b, b.sessionId);
    await saveStadiumInfo({ ...INFO, name: "Bravo", brandPreset: "teal" });

    actAs(a);
    const onA = await currentBrandIdentity();
    actAs(b);
    const onB = await currentBrandIdentity();
    expect(onA).toEqual({ symbol: "A", preset: "red" });
    expect(onB).toEqual({ symbol: "B", preset: "teal" });
    expect(brandVersion(onA)).not.toBe(brandVersion(onB));
  });

  it("a change of name or colour changes the version, so caches pick it up", async () => {
    await saveStadiumInfo({ ...INFO, name: "Alpha", brandPreset: "red" });
    const first = brandVersion(await loadBrandIdentity(a.tenantSlug));
    await saveStadiumInfo({ ...INFO, name: "Alpha Two", brandPreset: "gold" });
    expect(brandVersion(await loadBrandIdentity(a.tenantSlug))).not.toBe(first);
  });
});
