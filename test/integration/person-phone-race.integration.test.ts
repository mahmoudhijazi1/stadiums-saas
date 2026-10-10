import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
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
 * Hardening round 2, item 1. WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 *
 * Two public requests with the same NEW phone on different pitches take different pitch locks, so
 * nothing serializes them: both can miss the person lookup and both insert. The unique index
 * (tenantId, phone) must not fail either request.
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

async function slot(pitchId: string, daysAhead: number, index: number) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const found = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  })[index];
  if (!found) throw new Error("no slot");
  return { start: found.start.toISOString(), end: found.end.toISOString() };
}

describe("the same new phone on two pitches at once", () => {
  it("both requests succeed and exactly one Person row exists (10 iterations)", async () => {
    const first = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
    const second = await platformDb.pitch.create({
      data: {
        tenantId: fixture.tenantId,
        name: "Pitch T2",
        scheduleConfig: first.scheduleConfig as object,
      } as Parameters<typeof platformDb.pitch.create>[0]["data"],
      select: { id: true },
    });

    for (let i = 0; i < 10; i += 1) {
      const phone = `0377${String(i).padStart(2, "0")}001`;
      const a = await slot(fixture.pitchId, 2 + i, 0);
      const b = await slot(second.id, 2 + i, 0);
      const settled = await Promise.allSettled([
        requestPublicSlot({ pitchId: fixture.pitchId, ...a, name: "Hassan", phone }),
        requestPublicSlot({ pitchId: second.id, ...b, name: "Hassan", phone }),
      ]);
      expect(settled.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
      // Whatever the stored form of the number is, each iteration adds exactly one person.
      expect(await platformDb.person.count({ where: { tenantId: fixture.tenantId } })).toBe(i + 1);
    }
  }, 180_000);
});
