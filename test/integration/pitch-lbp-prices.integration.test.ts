import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createPitch } from "@/modules/venue/application/create-pitch";
import { updatePitch } from "@/modules/venue/application/update-pitch";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import { parsePitchDraft } from "@/modules/venue/schemas/pitch-draft";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 4: create-pitch and update-pitch check the prices against the stadium's own
 * gamePriceCurrency (read from its settings, never from the form). An LBP stadium needs an LBP default
 * price in steps of 5,000; a USD stadium behaves as before; the other currency's prices are kept.
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

async function pricesIn(currency: "USD" | "LBP") {
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: { settings: { perPlayerSplitEnabled: true, gamePriceCurrency: currency } },
  });
  clearReactCache();
}

function draft(fields: { name?: string; defaultPriceUsd?: string; defaultPriceLbp?: string; priceRules?: unknown[] } = {}) {
  return parsePitchDraft({
    name: fields.name ?? "Pitch LBP",
    slotDurationMinutes: "60",
    defaultPlayerCount: "10",
    defaultPriceUsd: fields.defaultPriceUsd ?? "0.00",
    ...(fields.defaultPriceLbp !== undefined ? { defaultPriceLbp: fields.defaultPriceLbp } : {}),
    hoursGroups: JSON.stringify([{ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], open: "16:00", close: "23:00" }]),
    priceRules: JSON.stringify(fields.priceRules ?? []),
  });
}

async function storedConfig(id: string) {
  return parseScheduleConfig((await platformDb.pitch.findUniqueOrThrow({ where: { id } })).scheduleConfig);
}

const pitchCount = () => platformDb.pitch.count({ where: { tenantId: fixture.tenantId } });

describe("pitch prices in an LBP stadium", () => {
  beforeEach(async () => {
    await pricesIn("LBP");
  });

  it("refuses a new pitch with no LBP default price, and writes nothing", async () => {
    const before = await pitchCount();
    await expect(createPitch(draft())).rejects.toMatchObject({ key: "venue.lbp_price_required" });
    await expect(createPitch(draft({ defaultPriceLbp: "" }))).rejects.toMatchObject({ key: "venue.lbp_price_required" });
    expect(await pitchCount()).toBe(before);
  });

  it("refuses an LBP price that is not a positive multiple of 5,000", async () => {
    const before = await pitchCount();
    for (const bad of ["12345", "2500", "0"]) {
      await expect(createPitch(draft({ defaultPriceLbp: bad }))).rejects.toMatchObject({ key: "venue.lbp_price_unit" });
    }
    await expect(
      createPitch(draft({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceLbp: "2501000" }] })),
    ).rejects.toMatchObject({ key: "venue.lbp_price_unit" });
    expect(await pitchCount()).toBe(before);
  });

  it("saves a pitch with a valid LBP default price", async () => {
    const { id } = await createPitch(draft({ defaultPriceLbp: "2000000", priceRules: [{ days: ["fri"], priceLbp: "2500000" }] }));
    const config = await storedConfig(id);
    expect(config.defaultPriceLbp).toBe("2000000");
    expect(config.defaultPriceUsd).toBe("0.00");
    expect(config.priceRules).toEqual([{ days: ["fri"], priceLbp: "2500000" }]);
  });

  it("refuses to update a pitch without an LBP default price, and keeps it as it was", async () => {
    const before = await storedConfig(fixture.pitchId);
    await expect(
      updatePitch({ pitchId: fixture.pitchId, draft: draft({ name: "Renamed", defaultPriceUsd: "30.00" }), liveBookings: [] }),
    ).rejects.toMatchObject({ key: "venue.lbp_price_required" });
    expect(await storedConfig(fixture.pitchId)).toEqual(before);
    expect((await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } })).name).not.toBe("Renamed");
  });

  it("updates a pitch with a valid LBP default price and keeps its USD prices", async () => {
    await updatePitch({
      pitchId: fixture.pitchId,
      draft: draft({ defaultPriceUsd: "30.00", defaultPriceLbp: "2700000", priceRules: [{ days: ["sat"], priceUsd: "40.00", priceLbp: "3600000" }] }),
      liveBookings: [],
    });
    const config = await storedConfig(fixture.pitchId);
    expect([config.defaultPriceUsd, config.defaultPriceLbp]).toEqual(["30.00", "2700000"]);
    expect(config.priceRules).toEqual([{ days: ["sat"], priceUsd: "40.00", priceLbp: "3600000" }]);
  });
});

describe("pitch prices in a USD stadium (as before)", () => {
  beforeEach(async () => {
    await pricesIn("USD");
  });

  it("saves a pitch with only a USD price", async () => {
    const { id } = await createPitch(draft({ defaultPriceUsd: "30.00" }));
    const config = await storedConfig(id);
    expect(config.defaultPriceUsd).toBe("30.00");
    expect(config.defaultPriceLbp).toBeUndefined();
  });

  it("keeps the stored pounds when an edit in dollars does not carry them", async () => {
    const { id } = await createPitch(draft({ defaultPriceUsd: "30.00", defaultPriceLbp: "2700000" }));
    await updatePitch({ pitchId: id, draft: draft({ defaultPriceUsd: "35.00" }), liveBookings: [] });
    const config = await storedConfig(id);
    expect([config.defaultPriceUsd, config.defaultPriceLbp]).toEqual(["35.00", "2700000"]);
  });

  it("still refuses pounds that ride along but are not in steps of 5,000", async () => {
    await expect(createPitch(draft({ defaultPriceUsd: "30.00", defaultPriceLbp: "2500" }))).rejects.toMatchObject({
      key: "venue.lbp_price_unit",
    });
  });
});
