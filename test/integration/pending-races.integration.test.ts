import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Audit §1.2: a public request racing an approve used to leave a PENDING row on a hour
 * that was already APPROVED. The request now takes the pitch lock and re-checks.
 */
const TIME_ZONE = "Asia/Beirut";
const RUNS = 10;

let fixture: TestFixture;
let phoneSeq = 0;

describe("public request vs approve", () => {
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

  it("never strands a PENDING on an approved hour, and the late requester is an interest", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const slot = await slotOn(2 + i, 0);
      const first = await request(slot, nextPhone());
      const latePhone = nextPhone();

      const results = await Promise.allSettled([
        approveBooking(first),
        request(slot, latePhone),
      ]);
      const [approve, late] = outcomes(results);
      expect(approve).toBe("ok");
      // Late request first: it became a sibling and approve rejected it.
      // Approve first: the request saw the approved hour.
      expect(["ok", "booking.slot_taken"]).toContain(late);

      expect(await pendingOnApprovedWindows()).toBe(0);
      const latePerson = await platformDb.person.findFirstOrThrow({
        where: { tenantId: fixture.tenantId, phone: latePhone },
      });
      expect(
        await platformDb.slotInterest.count({ where: { personId: latePerson.id } }),
      ).toBe(1);
    }
  }, 60_000);

  it("a request for an hour that is already approved creates no PENDING and one interest", async () => {
    const slot = await slotOn(2, 1);
    const first = await request(slot, nextPhone());
    await approveBooking(first);
    const phone = nextPhone();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(request(slot, phone)).rejects.toMatchObject({ key: "booking.slot_taken" });
    }

    expect(await platformDb.booking.count({ where: { status: "PENDING" } })).toBe(0);
    const person = await platformDb.person.findFirstOrThrow({
      where: { tenantId: fixture.tenantId, phone },
    });
    // Asking twice does not add a second interest.
    expect(await platformDb.slotInterest.count({ where: { personId: person.id } })).toBe(1);
  });
});

function outcomes(results: PromiseSettledResult<unknown>[]): string[] {
  return results.map((result) =>
    result.status === "fulfilled"
      ? "ok"
      : ((result.reason as { key?: string })?.key ?? String(result.reason)),
  );
}

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(900000 + phoneSeq)}`;
}

async function slotOn(daysAhead: number, index: number) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const config = parseScheduleConfig(pitch.scheduleConfig);
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slot = generateSlotsForDay({ config, localDate: day, timeZone: TIME_ZONE, occupied: [] })[
    index
  ];
  if (!slot) throw new Error(`no slot ${index} on day offset ${daysAhead}`);
  return slot;
}

async function request(slot: { start: Date; end: Date }, phone: string): Promise<string> {
  const { bookingId } = await requestPublicSlot({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name: "لاعب",
    phone,
  });
  return bookingId;
}

async function pendingOnApprovedWindows(): Promise<number> {
  const [row] = await platformDb.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM "Booking" p
    JOIN "Booking" a
      ON a."pitchId" = p."pitchId"
     AND a.status = 'APPROVED'::"BookingStatus"
     AND p.status = 'PENDING'::"BookingStatus"
     AND a.during && p.during
  `;
  return Number(row?.n ?? 0);
}
