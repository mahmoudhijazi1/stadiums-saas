import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { dismissMissedRequests } from "@/modules/booking/application/dismiss-missed-requests";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import {
  insertPendingPublicBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
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
 * Audit §1.2: a public request racing an approve used to leave a PENDING row on a hour
 * that was already APPROVED. The request now takes the pitch lock and re-checks.
 */
const TIME_ZONE = "Asia/Beirut";
const RUNS = 10;

let fixture: TestFixture;
let phoneSeq = 0;

// One teardown for the file: finishIntegrationFile ends the pool.
afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

describe("public request vs approve", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
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

describe("dismiss missed vs They played", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
  });

  it("locks the pending rows in one order: no deadlock, both calls finish cleanly", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      // Three missed requests on one past hour. "They played" approves the middle one
      // while "Dismiss all" rejects every missed request. Before the fix, approve locked
      // the middle row first and dismiss the first row first: a deadlock (P2034).
      const slot = await slotOn(-2 - i, 0);
      const ids: string[] = [];
      for (let n = 0; n < 3; n += 1) ids.push(await missedRequest(slot));
      const played = ids[1]!;

      const results = await Promise.allSettled([
        approveBooking(played, { allowStarted: true }),
        dismissMissedRequests(),
      ]);
      const [approve, dismiss] = outcomes(results);
      expect(JSON.stringify(results)).not.toContain("P2034");
      expect(dismiss).toBe("ok");
      // Approve first: it wins and rejects the other two. Dismiss first: all three are
      // rejected and approve reports the request is no longer pending.
      expect(["ok", "booking.no_longer_pending"]).toContain(approve);

      const statuses = await platformDb.booking.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true },
      });
      expect(statuses.filter((row) => row.status === "PENDING")).toEqual([]);
      const approved = statuses.filter((row) => row.status === "APPROVED");
      expect(approved.map((row) => row.id)).toEqual(approve === "ok" ? [played] : []);
    }
  }, 60_000);
});

async function missedRequest(slot: { start: Date; end: Date }): Promise<string> {
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "فائت", phone: nextPhone() });
    const bookingId = await insertPendingPublicBooking(tx, {
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, {
      bookingId,
      personId: person.id,
      amountDueUsd: new Decimal("30.00"),
    });
    return bookingId;
  });
}

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
