import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { setBookingRules } from "@/modules/access/application/set-booking-rules";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { localTimeToUtc } from "@/modules/venue/domain/availability";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

const TIME_ZONE = "Asia/Beirut";
// Saturday 12 Sep 2026 (Beirut, UTC+3).
const SATURDAY = { year: 2026, month: 9, day: 12 };
const RULES = {
  cancellationWindowHours: 24,
  lateCancellationFeePercent: 0,
  noShowFeePercent: 100,
  perPlayerSplitEnabled: false,
} as const;

let fixture: TestFixture;

async function setSettings(settings: Record<string, number>): Promise<void> {
  await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { settings } });
  clearReactCache();
}

/** An approved game at 00:30 Saturday (Beirut). */
async function gameAt0030(): Promise<string> {
  const start = localTimeToUtc(SATURDAY, 0, 30, TIME_ZONE);
  const end = new Date(start.getTime() + 3_600_000);
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "ليلي", phone: "03999001" });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start,
      end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, {
      bookingId: id,
      personId: person.id,
      amountDueUsd: new Decimal("30.00"),
    });
    return id;
  });
}

async function idsOn(date: string): Promise<string[]> {
  const day = await loadOwnerDay(date, new Date("2026-09-12T12:00:00Z"));
  return day.games.map((game) => game.id);
}

describe("per-tenant business-day start hour", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("with 0, a 00:30 game appears under its calendar date", async () => {
    await setSettings({ dayStartHour: 0 });
    const id = await gameAt0030();
    expect(await idsOn("2026-09-12")).toEqual([id]);
    expect(await idsOn("2026-09-11")).toEqual([]);
  });

  it("with 6, a 00:30 game appears under the previous date", async () => {
    await setSettings({ dayStartHour: 6 });
    const id = await gameAt0030();
    expect(await idsOn("2026-09-11")).toEqual([id]);
    expect(await idsOn("2026-09-12")).toEqual([]);
  });

  it("an absent value behaves as 6", async () => {
    await setSettings({});
    const id = await gameAt0030();
    expect(await idsOn("2026-09-11")).toEqual([id]);
    expect(await idsOn("2026-09-12")).toEqual([]);
  });

  it("Today's default day at 00:30 and 06:30 follows the setting", async () => {
    const at0030 = new Date("2026-09-11T21:30:00Z");
    const at0630 = new Date("2026-09-12T03:30:00Z");
    const dayOf = async (now: Date) => {
      const day = await loadOwnerDay(undefined, now);
      return `${day.day.year}-${String(day.day.month).padStart(2, "0")}-${String(day.day.day).padStart(2, "0")}`;
    };

    await setSettings({ dayStartHour: 6 });
    expect(await dayOf(at0030)).toBe("2026-09-11");
    expect(await dayOf(at0630)).toBe("2026-09-12");

    await setSettings({ dayStartHour: 0 });
    expect(await dayOf(at0030)).toBe("2026-09-12");
    expect(await dayOf(at0630)).toBe("2026-09-12");
  });

  it("changing it requires settings.manage", async () => {
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(await createStaffSession(fixture.tenantId, { "bookings.adjust_due": true }));
    await expect(setBookingRules({ ...RULES, dayStartHour: 3 })).rejects.toMatchObject({
      key: "access.not_allowed",
    });

    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(await createStaffSession(fixture.tenantId, { "settings.manage": true }));
    await setBookingRules({ ...RULES, dayStartHour: 3 });
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: fixture.tenantId } });
    expect(parseTenantSettings(tenant.settings).dayStartHour).toBe(3);
  });
});
