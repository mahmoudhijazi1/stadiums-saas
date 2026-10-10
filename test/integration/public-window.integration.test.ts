import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { PUBLIC_FUTURE_DAYS } from "@/modules/booking/domain/public-window";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Hardening round 2, item 4 (N-9). WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 */
const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

async function slotOn(daysAhead: number) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slot = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  })[0]!;
  return { start: slot.start.toISOString(), end: slot.end.toISOString() };
}

describe("the public booking window", () => {
  it("the last day of the window is accepted and the next day is refused", async () => {
    const last = await slotOn(PUBLIC_FUTURE_DAYS);
    await expect(
      requestPublicSlot({ pitchId: fixture.pitchId, ...last, name: "Hassan", phone: "03555001" }),
    ).resolves.toMatchObject({ bookingId: expect.any(String) });

    const beyond = await slotOn(PUBLIC_FUTURE_DAYS + 1);
    await expect(
      requestPublicSlot({ pitchId: fixture.pitchId, ...beyond, name: "Hassan", phone: "03555001" }),
    ).rejects.toMatchObject({ key: "booking.too_far" });
    expect(await platformDb.booking.count()).toBe(1);
  });

  it("a request a year ahead is refused and writes nothing", async () => {
    const far = await slotOn(365);
    await expect(
      requestPublicSlot({ pitchId: fixture.pitchId, ...far, name: "Layla", phone: "03555002" }),
    ).rejects.toMatchObject({ key: "booking.too_far" });
    expect(await platformDb.booking.count()).toBe(0);
    expect(await platformDb.person.count()).toBe(0);
  });
});
