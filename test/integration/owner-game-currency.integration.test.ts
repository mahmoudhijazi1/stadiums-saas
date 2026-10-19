import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { loadGameCurrencySetting, setOwnGameCurrency } from "@/modules/stadium/application/game-currency";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { nextPhone, slotOn } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 decision 1, the owner's own "Game prices in" setting: the owner switches USD <-> LBP in More >
 * Settings. The use case refuses a switch while a pitch has no price in the new currency, only the
 * setting changes (existing games keep their currency), and each change writes one audit row
 * `tenant.game_currency`. Owner only: staff cannot, even with settings.manage. WRITTEN, NOT RUN when
 * authored: treat every expectation as unverified until the integration suite has run.
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
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
});

async function pitchConfig() {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  // A plain copy, typed loosely so it can be written back as JSON.
  return JSON.parse(JSON.stringify(pitch.scheduleConfig));
}

async function givePitchAnLbpPrice() {
  await platformDb.pitch.update({
    where: { id: fixture.pitchId },
    data: { scheduleConfig: { ...(await pitchConfig()), defaultPriceLbp: "2000000" } },
  });
}

async function currencyOnRecord() {
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: fixture.tenantId } });
  return (tenant.settings as { gamePriceCurrency?: string }).gamePriceCurrency ?? "USD";
}

const audits = () => platformDb.platformAuditLog.findMany({ where: { action: "tenant.game_currency" } });

async function book(days: number, name: string) {
  const slot = await slotOn(fixture, days);
  const { bookingId } = await createOwnerBooking({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name,
    phone: nextPhone(),
  });
  return platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
}

describe("the owner switches USD to LBP", () => {
  it("when every pitch has an LBP price: the setting changes, one audit row, existing games keep USD, the next booking is in LBP", async () => {
    const before = await book(3, "Before");
    expect(before.priceCurrency).toBe("USD");
    await givePitchAnLbpPrice();

    const sheet = await loadGameCurrencySetting();
    expect(sheet).toEqual({ current: "USD", target: "LBP", missing: [] });

    await setOwnGameCurrency({ currency: "LBP" });
    expect(await currencyOnRecord()).toBe("LBP");

    const rows = await audits();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tenantId: fixture.tenantId });
    expect(rows[0]!.actor).toMatch(/^owner:/);
    const membership = await platformDb.membership.findFirstOrThrow({ where: { tenantId: fixture.tenantId, role: "OWNER" } });
    expect(rows[0]!.detail).toEqual({ from: "USD", to: "LBP", membershipId: membership.id });

    // The game made before the switch is untouched.
    const same = await platformDb.booking.findUniqueOrThrow({ where: { id: before.id } });
    expect([same.priceCurrency, same.priceUsd?.toFixed(2), same.priceLbp]).toEqual(["USD", "30.00", null]);

    // The next booking is priced in pounds (the request's cached tenant is dropped, as a new request would).
    clearReactCache();
    const after = await book(4, "After");
    expect([after.priceCurrency, after.priceLbp?.toFixed(0), after.priceUsd]).toEqual(["LBP", "2000000", null]);
  });

  it("and back to USD, with a second audit row", async () => {
    await givePitchAnLbpPrice();
    await setOwnGameCurrency({ currency: "LBP" });
    clearReactCache();
    await setOwnGameCurrency({ currency: "USD" });
    expect(await currencyOnRecord()).toBe("USD");
    expect((await audits()).map((row) => row.detail)).toEqual([
      expect.objectContaining({ from: "USD", to: "LBP" }),
      expect.objectContaining({ from: "LBP", to: "USD" }),
    ]);
  });

  it("the same currency again is refused and writes nothing", async () => {
    await expect(setOwnGameCurrency({ currency: "USD" })).rejects.toMatchObject({ key: "settings.game_currency_unchanged" });
    expect(await audits()).toHaveLength(0);
  });
});

describe("a pitch without an LBP price", () => {
  it("refuses the switch in the use case, changes nothing, and the sheet lists that pitch", async () => {
    await expect(setOwnGameCurrency({ currency: "LBP" })).rejects.toMatchObject({ key: "settings.game_currency_missing_prices" });
    expect(await currencyOnRecord()).toBe("USD");
    expect(await audits()).toHaveLength(0);

    const sheet = await loadGameCurrencySetting();
    expect(sheet.current).toBe("USD");
    expect(sheet.target).toBe("LBP");
    expect(sheet.missing).toEqual([{ id: fixture.pitchId, name: expect.any(String) }]);
  });

  it("one pitch with a price and one without: only the one without is listed, and the switch is still refused", async () => {
    // The second pitch is made first, from the unpriced config; then only the first gets a pound price.
    const other = await platformDb.pitch.create({
      data: { tenantId: fixture.tenantId, name: "Second pitch", scheduleConfig: await pitchConfig() },
    });
    await givePitchAnLbpPrice();
    const sheet = await loadGameCurrencySetting();
    expect(sheet.missing.map((pitch) => pitch.id)).toEqual([other.id]);
    await expect(setOwnGameCurrency({ currency: "LBP" })).rejects.toMatchObject({ key: "settings.game_currency_missing_prices" });
    expect(await currencyOnRecord()).toBe("USD");
  });
});

describe("staff", () => {
  it("cannot switch or even read the setting, with or without settings.manage", async () => {
    await givePitchAnLbpPrice();
    for (const flags of [{} as Record<string, true>, { "settings.manage": true } as Record<string, true>]) {
      const token = await createStaffSession(fixture.tenantId, flags);
      clearRequestStubs();
      setTenantSlug(fixture.tenantSlug);
      setSessionCookie(token);
      await expect(setOwnGameCurrency({ currency: "LBP" })).rejects.toMatchObject({ key: "access.not_allowed" });
      await expect(loadGameCurrencySetting()).rejects.toMatchObject({ key: "access.not_allowed" });
    }
    expect(await currencyOnRecord()).toBe("USD");
    expect(await audits()).toHaveLength(0);
  });
});
