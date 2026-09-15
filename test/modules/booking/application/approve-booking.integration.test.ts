import {
  describe,
  expect,
  it,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { prismaBase } from "@/lib/prisma-base";
import { platformDb } from "@/lib/platform-db";
import { DomainError } from "@/lib/errors";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import {
  insertPendingPublicBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { createPerson } from "@/modules/people/infrastructure/persons";
import {
  clearRequestStubs,
  setSessionCookie,
  setTenantSlug,
} from "../../../integration/request-stubs";
import { truncateAll } from "../../../integration/truncate";
import {
  seedMinimalFixture,
  type TestFixture,
} from "../../../integration/fixtures";

async function insertPendingWithRequester(
  fixture: TestFixture,
  window: { start: Date; end: Date },
  phone: string,
  name: string,
): Promise<string> {
  return db.$transaction(async (tx) => {
    const person = await createPerson(tx, { name, phone });
    const bookingId = await insertPendingPublicBooking(tx, {
      pitchId: fixture.pitchId,
      start: window.start,
      end: window.end,
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

async function bookingStatus(id: string): Promise<string | null> {
  const rows = await platformDb.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status FROM "Booking" WHERE id = ${id}
  `;
  return rows[0]?.status ?? null;
}

async function slotInterestCount(pitchId: string): Promise<number> {
  const rows = await platformDb.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "SlotInterest" WHERE "pitchId" = ${pitchId}
  `;
  return Number(rows[0]?.n ?? 0);
}

describe("approveBooking (integration)", () => {
  let fixture: TestFixture;
  /** Monday 2026-10-05 16:00–17:00 Asia/Beirut → 13:00–14:00 UTC. */
  const start = new Date("2026-10-05T13:00:00.000Z");
  const end = new Date("2026-10-05T14:00:00.000Z");

  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
  });

  afterAll(async () => {
    await truncateAll();
    await prismaBase.$disconnect();
  });

  it("approves a PENDING request and rejects an overlapping PENDING", async () => {
    const winnerId = await insertPendingWithRequester(
      fixture,
      { start, end },
      "71111111",
      "Winner",
    );
    const loserId = await insertPendingWithRequester(
      fixture,
      { start, end },
      "72222222",
      "Loser",
    );

    await approveBooking(winnerId);

    expect(await bookingStatus(winnerId)).toBe("APPROVED");
    expect(await bookingStatus(loserId)).toBe("REJECTED");
    expect(await slotInterestCount(fixture.pitchId)).toBe(1);
  });

  it("maps a real 23P01 during approve to booking.slot_unavailable", async () => {
    const aId = await insertPendingWithRequester(
      fixture,
      { start, end },
      "76666666",
      "First",
    );
    const bId = await insertPendingWithRequester(
      fixture,
      { start, end },
      "77777777",
      "Second",
    );

    await approveBooking(aId);
    expect(await bookingStatus(aId)).toBe("APPROVED");

    // Revive the rejected loser so setPendingStatus can target PENDING again.
    await platformDb.$executeRaw`
      UPDATE "Booking"
      SET status = 'PENDING'::"BookingStatus"
      WHERE id = ${bId}
    `;

    // Soft occupied check would throw slot_taken. Empty list forces the UPDATE
    // into Booking_approved_during_excl. (Local prisma dev is single-connection,
    // so a real concurrent race cannot hit this TOCTOU path.)
    let caught: unknown;
    try {
      await approveBooking(bId, { listApprovedRanges: async () => [] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).key).toBe("booking.slot_unavailable");
    expect(await bookingStatus(aId)).toBe("APPROVED");
    expect(await bookingStatus(bId)).not.toBe("APPROVED");
  });

  it("does not nest platformDb.tenant.findUnique during the transaction (A+B)", async () => {
    const bookingId = await insertPendingWithRequester(
      fixture,
      { start, end },
      "75555555",
      "Solo",
    );

    const spy = jest.spyOn(platformDb.tenant, "findUnique");
    spy.mockClear();

    const started = Date.now();
    await approveBooking(bookingId);
    const elapsed = Date.now() - started;

    // A — must finish well under Prisma's 5s interactive-tx hang.
    expect(elapsed).toBeLessThan(5_000);

    // B — tenant already cached; approve must not re-hit platformDb (deadlock guard).
    expect(spy.mock.calls.length).toBe(0);

    spy.mockRestore();
    expect(await bookingStatus(bookingId)).toBe("APPROVED");
  });
});
