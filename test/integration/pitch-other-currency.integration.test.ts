import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { loadGameCurrencySetting, setOwnGameCurrency } from "@/modules/stadium/application/game-currency";
import { updatePitch } from "@/modules/venue/application/update-pitch";
import { parsePitchDraft } from "@/modules/venue/schemas/pitch-draft";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Hotfix: a stadium priced in dollars can save its pitch prices in pounds from the editor's other-
 * currency section, and so can switch to pounds afterwards. WRITTEN, NOT RUN when authored.
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

const HOURS = JSON.stringify([{ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], open: "16:00", close: "22:00" }]);

/** What the editor posts: the dollar prices as today, the pounds from the other-currency section. */
function draft(over: { defaultPriceLbp?: string; priceRules?: unknown[] } = {}) {
  return parsePitchDraft({
    name: "Main",
    slotDurationMinutes: "60",
    defaultPlayerCount: "10",
    defaultPriceUsd: "30.00",
    defaultPriceLbp: over.defaultPriceLbp ?? "",
    hoursGroups: HOURS,
    priceRules: JSON.stringify(over.priceRules ?? []),
    confirmPending: "",
  });
}

const save = (input: Parameters<typeof draft>[0]) =>
  updatePitch({ pitchId: fixture.pitchId, draft: draft(input), liveBookings: [], now: new Date() });

async function stored() {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  return pitch.scheduleConfig as unknown as {
    defaultPriceUsd: string;
    defaultPriceLbp?: string;
    priceRules: { priceUsd?: string; priceLbp?: string }[];
  };
}

describe("a stadium priced in dollars saves a price in pounds", () => {
  it("stores the LBP default and keeps the USD prices", async () => {
    await save({ defaultPriceLbp: "2000000" });
    expect(await stored()).toMatchObject({ defaultPriceUsd: "30.00", defaultPriceLbp: "2000000" });
  });

  it("and can then switch to pounds from the settings (the owner path)", async () => {
    await expect(setOwnGameCurrency({ currency: "LBP" })).rejects.toMatchObject({ key: "settings.game_currency_missing_prices" });
    expect((await loadGameCurrencySetting()).missing.map((pitch) => pitch.id)).toEqual([fixture.pitchId]);

    await save({ defaultPriceLbp: "2000000" });
    clearReactCache();
    expect((await loadGameCurrencySetting()).missing).toEqual([]);
    await setOwnGameCurrency({ currency: "LBP" });
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: fixture.tenantId } });
    expect((tenant.settings as { gamePriceCurrency?: string }).gamePriceCurrency).toBe("LBP");
  });

  it("a price rule without a pound price still blocks the switch, and the pound price on the card unblocks it", async () => {
    await save({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceUsd: "40.00" }] });
    expect((await loadGameCurrencySetting()).missing).toHaveLength(1);
    await expect(setOwnGameCurrency({ currency: "LBP" })).rejects.toMatchObject({ key: "settings.game_currency_missing_prices" });

    await save({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceUsd: "40.00", priceLbp: "3000000" }] });
    expect((await loadGameCurrencySetting()).missing).toEqual([]);
    await setOwnGameCurrency({ currency: "LBP" });
    expect((await stored()).priceRules).toEqual([expect.objectContaining({ priceUsd: "40.00", priceLbp: "3000000" })]);
  });

  it("12,345 is refused with the unit error and nothing is stored", async () => {
    await expect(save({ defaultPriceLbp: "12345" })).rejects.toMatchObject({ key: "venue.lbp_price_unit" });
    expect((await stored()).defaultPriceLbp).toBeUndefined();
  });
});
