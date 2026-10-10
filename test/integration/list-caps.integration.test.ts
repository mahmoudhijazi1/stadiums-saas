import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { listApprovedOccupied } from "@/modules/booking/application/list-approved-occupied";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Security audit S-8: every list a page reads is bounded. The decision paths
 * (approve rejecting overlapping pending) still see every row.
 */
const HOUR = 60 * 60 * 1000;

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  signIn();
});

function signIn() {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
}

/**
 * `count` bookings with a requester each. Booking i starts at base + i × stepMs
 * and lasts an hour; one person per booking.
 */
async function insertBookings(input: {
  count: number;
  base: Date;
  stepMs: number;
  status: "PENDING" | "APPROVED";
  tag: string;
}) {
  const { count, base, stepMs, status, tag } = input;
  await platformDb.$executeRaw`
    INSERT INTO "Person" (id, "tenantId", name, phone, "searchName")
    SELECT ${tag} || '-p' || g, ${fixture.tenantId}, 'P' || g, ${tag} || lpad(g::text, 6, '0'), 'p' || g
    FROM generate_series(1, ${count}) g`;
  await platformDb.$executeRaw`
    INSERT INTO "Booking" (id, "tenantId", "pitchId", during, status, source, "priceUsd", "amountDueUsd", "collectionMode")
    SELECT ${tag} || '-b' || g, ${fixture.tenantId}, ${fixture.pitchId},
      tstzrange(${base}::timestamptz + (g - 1) * ${stepMs} * interval '1 millisecond',
                ${base}::timestamptz + (g - 1) * ${stepMs} * interval '1 millisecond' + interval '1 hour', '[)'),
      ${status}::"BookingStatus", 'PUBLIC'::"BookingSource", 30, 30, 'WHOLE'::"CollectionMode"
    FROM generate_series(1, ${count}) g`;
  await platformDb.$executeRaw`
    INSERT INTO "BookingParticipant" (id, "tenantId", "bookingId", "personId", "amountDueUsd", "isRequester")
    SELECT ${tag} || '-bp' || g, ${fixture.tenantId}, ${tag} || '-b' || g, ${tag} || '-p' || g, 30, true
    FROM generate_series(1, ${count}) g`;
}

describe("pending inbox", () => {
  it("shows at most the 200 next upcoming and the 50 latest missed requests", async () => {
    const soon = new Date(Date.now() + 2 * HOUR);
    await insertBookings({ count: 230, base: soon, stepMs: HOUR, status: "PENDING", tag: "up" });
    const longAgo = new Date(Date.now() - 400 * HOUR);
    await insertBookings({ count: 80, base: longAgo, stepMs: HOUR, status: "PENDING", tag: "miss" });

    const rows = await listPendingRequests();
    const now = Date.now();
    const upcoming = rows.filter((row) => row.start.getTime() > now);
    const missed = rows.filter((row) => row.start.getTime() <= now);
    expect(upcoming).toHaveLength(200);
    expect(missed).toHaveLength(50);
    // The nearest upcoming and the latest missed are the ones kept.
    expect(upcoming[0]!.id).toBe("up-b1");
    expect(missed.map((row) => row.id)).toContain("miss-b80");
    expect(missed.map((row) => row.id)).not.toContain("miss-b1");
    // Still in start order.
    const starts = rows.map((row) => row.start.getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("approve still rejects every overlapping pending request, beyond the page cap", async () => {
    const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
    const [slot] = generateSlotsForDay({
      config: parseScheduleConfig(pitch.scheduleConfig),
      localDate: addCalendarDays(civilDateInTimeZone(new Date(), "Asia/Beirut"), 2),
      timeZone: "Asia/Beirut",
      occupied: [],
    });
    await insertBookings({ count: 260, base: slot!.start, stepMs: 0, status: "PENDING", tag: "same" });
    signIn();
    await approveBooking("same-b1");
    expect(await platformDb.booking.count({ where: { status: "PENDING" } })).toBe(0);
    expect(await platformDb.booking.count({ where: { status: "REJECTED" } })).toBe(259);
  });
});

describe("approved occupancy", () => {
  it("returns only bookings that end after now minus one day", async () => {
    await insertBookings({ count: 1, base: new Date(Date.now() - 72 * HOUR), stepMs: 0, status: "APPROVED", tag: "old" });
    await insertBookings({ count: 1, base: new Date(Date.now() - 20 * HOUR), stepMs: 0, status: "APPROVED", tag: "recent" });
    await insertBookings({ count: 1, base: new Date(Date.now() + 24 * HOUR), stepMs: 0, status: "APPROVED", tag: "next" });
    const ranges = await listApprovedOccupied();
    const starts = ranges.map((range) => range.start.getTime()).sort();
    expect(ranges).toHaveLength(2);
    expect(starts[0]).toBeGreaterThan(Date.now() - 21 * HOUR);
  });
});

describe("waitlist interests", () => {
  it("ignores interests on windows that ended more than a day ago", async () => {
    await insertBookings({ count: 1, base: new Date(Date.now() - 72 * HOUR), stepMs: 0, status: "PENDING", tag: "w" });
    await platformDb.$executeRaw`
      INSERT INTO "SlotInterest" (id, "tenantId", "pitchId", during, "personId")
      VALUES ('si-old', ${fixture.tenantId}, ${fixture.pitchId},
        tstzrange(now() - interval '72 hours', now() - interval '71 hours', '[)'), 'w-p1')`;
    const { listSlotInterestsWithPeople } = await import("@/modules/booking/infrastructure/bookings");
    const db = (await import("@/lib/db")).default;
    const { withCurrentTenant } = await import("@/lib/tenant-context");
    const rows = await withCurrentTenant(() => listSlotInterestsWithPeople(db));
    expect(rows).toHaveLength(0);
    expect(await listOpenWaitlist()).toEqual([]);
  });
});
