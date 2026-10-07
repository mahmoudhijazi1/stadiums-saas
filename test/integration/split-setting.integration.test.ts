import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { setBookingRules } from "@/modules/access/application/set-booking-rules";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import {
  collectAllRemaining,
  collectSlotPayment,
} from "@/modules/booking/application/collect-player-payment";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import {
  switchToPerPlayer,
  switchToWhole,
} from "@/modules/booking/application/switch-collection-mode";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

const TIME_ZONE = "Asia/Beirut";
const RULES = {
  cancellationWindowHours: 24,
  lateCancellationFeePercent: 0,
  noShowFeePercent: 100,
} as const;

let fixture: TestFixture;

async function setSplit(enabled: boolean): Promise<void> {
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: { settings: { perPlayerSplitEnabled: enabled } },
  });
  clearReactCache();
}

async function booking(daysAhead: number, phone: string): Promise<string> {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const [slot] = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  });
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "جو", phone });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start: slot!.start,
      end: slot!.end,
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

async function slotsOf(bookingId: string) {
  return platformDb.bookingParticipant.findMany({
    where: { bookingId, slotNumber: { not: null } },
    orderBy: { slotNumber: "asc" },
  });
}

describe("per-player split setting", () => {
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

  it("old settings rows parse with the split off", () => {
    expect(parseTenantSettings({}).perPlayerSplitEnabled).toBe(false);
    expect(parseTenantSettings({ perPlayerSplitEnabled: "yes" }).perPlayerSplitEnabled).toBe(false);
  });

  it("refuses the switch while disabled and leaves the booking whole", async () => {
    await setSplit(false);
    const bookingId = await booking(3, "03333001");

    await expect(switchToPerPlayer({ bookingId, count: 5 })).rejects.toMatchObject({
      key: "booking.split_disabled",
    });
    const row = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(row.collectionMode).toBe("WHOLE");
    expect(await slotsOf(bookingId)).toHaveLength(0);
  });

  it("works as before while enabled", async () => {
    await setSplit(true);
    const bookingId = await booking(3, "03333002");
    await switchToPerPlayer({ bookingId, count: 5 });
    expect(await slotsOf(bookingId)).toHaveLength(5);
  });

  it("a split booking stays payable and can go back to whole while disabled", async () => {
    await setSplit(true);
    const bookingId = await booking(3, "03333003");
    await switchToPerPlayer({ bookingId, count: 5 });
    await setSplit(false);

    const slots = await slotsOf(bookingId);
    await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
    await collectAllRemaining({ bookingId });
    const paid = await platformDb.payment.count({ where: { sourceId: bookingId } });
    expect(paid).toBe(2);

    const other = await booking(4, "03333004");
    await setSplit(true);
    await switchToPerPlayer({ bookingId: other, count: 4 });
    await setSplit(false);
    await switchToWhole({ bookingId: other });
    const row = await platformDb.booking.findUniqueOrThrow({ where: { id: other } });
    expect(row.collectionMode).toBe("WHOLE");
  });

  it("cancel and no-show still collapse a split booking while disabled", async () => {
    await setSplit(true);
    const cancelled = await booking(3, "03333005");
    const missed = await booking(-2, "03333006");
    await switchToPerPlayer({ bookingId: cancelled, count: 5 });
    await switchToPerPlayer({ bookingId: missed, count: 5 });
    await setSplit(false);

    await cancelBooking({ bookingId: cancelled, initiator: "OWNER" });
    await recordNoShow({ bookingId: missed });
    for (const id of [cancelled, missed]) {
      const row = await platformDb.booking.findUniqueOrThrow({ where: { id } });
      expect(row.collectionMode).toBe("WHOLE");
    }
  });

  it("changing the setting requires settings.manage", async () => {
    const staff = await createStaffSession(fixture.tenantId, { "bookings.adjust_due": true });
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(staff);
    await expect(
      setBookingRules({ ...RULES, perPlayerSplitEnabled: true }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });

    const manager = await createStaffSession(fixture.tenantId, { "settings.manage": true });
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(manager);
    await setBookingRules({ ...RULES, perPlayerSplitEnabled: true });
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: fixture.tenantId } });
    expect(parseTenantSettings(tenant.settings).perPlayerSplitEnabled).toBe(true);
  });
});
