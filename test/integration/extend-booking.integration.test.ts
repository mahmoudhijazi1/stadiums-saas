import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { platformDb } from "@/lib/platform-db";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { extendBooking } from "@/modules/booking/application/extend-booking";
import { loadExtensionOffers } from "@/modules/booking/application/load-extension-offers";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import { setBookingEndAndPrice } from "@/modules/booking/infrastructure/bookings";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Extend a booking by 30 minutes. WRITTEN, NOT RUN when authored (the task forbade running
 * suites): treat every expectation as unverified until `npm run test:integration` has been run.
 *
 * The fixture pitch is open 16:00 to 22:00 every day, 60-minute games, $30. Slot index 0 is
 * 16:00-17:00 Beirut, index 5 is 21:00-22:00.
 */
const TIME_ZONE = "Asia/Beirut";
const THIRTY = 30 * 60 * 1000;

let fixture: TestFixture;

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  actAsOwner();
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

function actAs(slug: string, token?: string) {
  clearRequestStubs();
  setTenantSlug(slug);
  if (token) setSessionCookie(token);
}
const actAsOwner = () => actAs(fixture.tenantSlug, fixture.sessionId);

async function slotAt(daysAhead: number, index: number, pitchId = fixture.pitchId) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slots = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  });
  const slot = slots[index];
  if (!slot) throw new Error(`no slot ${index} at +${daysAhead}`);
  return { pitchId, start: slot.start.toISOString(), end: slot.end.toISOString(), endAt: slot.end };
}

async function bookGame(daysAhead: number, index: number, phone = "03111001") {
  const slot = await slotAt(daysAhead, index);
  const { bookingId } = await createOwnerBooking({ ...slot, name: "هدى", phone });
  return { bookingId, slot };
}

async function rangeOf(bookingId: string) {
  const [row] = await platformDb.$queryRaw<
    { start: Date; end: Date; status: string; priceUsd: string; amountDueUsd: string }[]
  >`SELECT lower(during) AS start, upper(during) AS end, status::text AS status,
           "priceUsd"::text AS "priceUsd", "amountDueUsd"::text AS "amountDueUsd"
    FROM "Booking" WHERE id = ${bookingId}`;
  return row!;
}

async function expectNoOverlaps(pitchId: string) {
  const approved = await platformDb.$queryRaw<{ start: Date; end: Date }[]>`
    SELECT lower(during) AS start, upper(during) AS end FROM "Booking"
    WHERE "pitchId" = ${pitchId} AND status = 'APPROVED'::"BookingStatus" ORDER BY lower(during)`;
  for (let i = 1; i < approved.length; i += 1) {
    expect(approved[i]!.start.getTime()).toBeGreaterThanOrEqual(approved[i - 1]!.end.getTime());
  }
  const [clash] = await platformDb.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "Booking" p JOIN "Booking" a
      ON a."pitchId" = p."pitchId" AND a.during && p.during
    WHERE p.status = 'PENDING'::"BookingStatus" AND a.status = 'APPROVED'::"BookingStatus"
      AND p."pitchId" = ${pitchId}`;
  expect(Number(clash?.n ?? 0)).toBe(0);
}

function onlyDomainErrors(settled: PromiseSettledResult<unknown>[]) {
  for (const result of settled) {
    if (result.status === "rejected") expect(result.reason).toBeInstanceOf(DomainError);
  }
}

const extend = (bookingId: string, endsAt: Date | string, addedPriceUsd?: Decimal) =>
  extendBooking({ bookingId, expectedEndsAt: new Date(endsAt), addedPriceUsd });

describe("the basic extension", () => {
  it("adds 30 minutes, raises the price and the due, and logs an EXTENSION change", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const result = await extend(bookingId, slot.end);

    expect(result.newEnd.getTime()).toBe(slot.endAt.getTime() + THIRTY);
    expect(result.addedPriceUsd.toFixed(2)).toBe("15.00");
    const row = await rangeOf(bookingId);
    expect(row.end.getTime()).toBe(slot.endAt.getTime() + THIRTY);
    expect(row.start.toISOString()).toBe(slot.start);
    expect(row.priceUsd).toBe("45.00");
    expect(row.amountDueUsd).toBe("45.00");

    const change = await platformDb.bookingDueChange.findFirstOrThrow({ where: { bookingId } });
    expect(change).toMatchObject({ reason: "EXTENSION" });
    expect(change.fromUsd.toFixed(2)).toBe("30.00");
    expect(change.toUsd.toFixed(2)).toBe("45.00");
    expect(change.note).toMatch(/→/);
    await assertMoneyInvariants([]);
  });

  it("is repeatable: 30, 30, 30... and the per-minute price holds", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    let end = new Date(slot.end);
    for (let step = 1; step <= 3; step += 1) {
      await extend(bookingId, end);
      end = new Date(end.getTime() + THIRTY);
    }
    const row = await rangeOf(bookingId);
    expect(row.end.getTime()).toBe(end.getTime());
    expect(row.amountDueUsd).toBe("75.00"); // 150 minutes at $0.50 a minute
    expect(await platformDb.bookingDueChange.count({ where: { bookingId, reason: "EXTENSION" } })).toBe(3);
  });

  it("collected money is untouched and the remaining grows by the added price", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: new Decimal("10.00") }] });
    await extend(bookingId, slot.end);

    const row = await rangeOf(bookingId);
    expect(row.amountDueUsd).toBe("45.00");
    const [tenders] = await platformDb.$queryRaw<{ sum: string }[]>`
      SELECT COALESCE(SUM(t."usdEquivalent"), 0)::text AS sum FROM "PaymentTender" t`;
    expect(tenders?.sum).toBe("10.00");
    await assertMoneyInvariants([]);
  });

  it("an owner may change the added amount; the price and the due rise by that amount", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const result = await extend(bookingId, slot.end, new Decimal("20.00"));
    expect(result.addedPriceUsd.toFixed(2)).toBe("20.00");
    const row = await rangeOf(bookingId);
    expect(row.priceUsd).toBe("50.00");
    expect(row.amountDueUsd).toBe("50.00");
  });

  it("refuses a negative or silly added amount", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await expect(extend(bookingId, slot.end, new Decimal("-1"))).rejects.toMatchObject({ key: "form.invalid" });
    await expect(extend(bookingId, slot.end, new Decimal("1000000"))).rejects.toMatchObject({ key: "form.invalid" });
    expect((await rangeOf(bookingId)).end.getTime()).toBe(slot.endAt.getTime());
  });

  // "During the game" is covered by the unit tests: it depends on the wall clock being inside the
  // pitch hours, which an integration test cannot control.
  it("refuses once the game has ended", async () => {
    const { bookingId } = await bookGame(3, 0);
    await platformDb.$executeRaw`UPDATE "Booking"
      SET during = tstzrange(now() - interval '2 hours', now() - interval '1 hour', '[)') WHERE id = ${bookingId}`;
    const ended = await rangeOf(bookingId);
    await expect(extend(bookingId, ended.end)).rejects.toMatchObject({ key: "booking.extend_ended" });
  });
});

describe("the double tap", () => {
  it("two calls with the same expectedEndsAt add 30 minutes once, not 60", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const settled = await Promise.allSettled([extend(bookingId, slot.end), extend(bookingId, slot.end)]);

    expect(settled.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = settled.find((r) => r.status === "rejected");
    expect(failed?.status === "rejected" ? (failed.reason as DomainError).key : "").toBe("booking.changed");
    const row = await rangeOf(bookingId);
    expect(row.end.getTime()).toBe(slot.endAt.getTime() + THIRTY);
    expect(row.amountDueUsd).toBe("45.00");
    expect(await platformDb.bookingDueChange.count({ where: { bookingId, reason: "EXTENSION" } })).toBe(1);
  });

  it("a stale expectedEndsAt is booking.changed", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await extend(bookingId, slot.end);
    await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "booking.changed" });
  });
});

describe("limits", () => {
  it("the 180-minute cap: three games' worth, and the fifth step is refused", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    let end = new Date(slot.end);
    for (let step = 0; step < 4; step += 1) {
      await extend(bookingId, end);
      end = new Date(end.getTime() + THIRTY);
    }
    expect((end.getTime() - new Date(slot.start).getTime()) / 60_000).toBe(180);
    await expect(extend(bookingId, end)).rejects.toMatchObject({ key: "booking.extend_max" });
    expect((await rangeOf(bookingId)).end.getTime()).toBe(end.getTime());
  });

  it("the next game on the pitch blocks it; a gap of 30 minutes allows it", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await createOwnerBooking({ ...(await slotAt(3, 1)), name: "سامي", phone: "03111002" });
    await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "booking.extend_next_game" });
    expect((await rangeOf(bookingId)).end.toISOString()).toBe(slot.endAt.toISOString());

    // Two hours apart there is room: game at 16:00, next at 18:00.
    const lone = await bookGame(4, 0, "03111003");
    await createOwnerBooking({ ...(await slotAt(4, 2)), name: "سامي", phone: "03111004" });
    await expect(extend(lone.bookingId, lone.slot.end)).resolves.toBeDefined();
  });

  it("closing time: the last game can grow to the closing minute and no further", async () => {
    const { bookingId, slot } = await bookGame(3, 4); // 20:00-21:00, closes 22:00
    let end = new Date(slot.end);
    await extend(bookingId, end); // 21:30
    end = new Date(end.getTime() + THIRTY);
    await extend(bookingId, end); // 22:00 exactly
    end = new Date(end.getTime() + THIRTY);
    await expect(extend(bookingId, end)).rejects.toMatchObject({ key: "booking.extend_closing" });
  });

  it("a window that crosses midnight lets a game run past midnight, up to closing", async () => {
    await platformDb.pitch.update({
      where: { id: fixture.pitchId },
      data: {
        scheduleConfig: parseScheduleConfig({
          slotDurationMinutes: 60,
          gapMinutes: 0,
          hours: Object.fromEntries(
            ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [day, [{ start: "22:00", end: "02:00" }]]),
          ),
          defaultPriceUsd: "30.00",
          priceRules: [],
        }),
      } as never,
    });
    // Slots 22-23, 23-00, 00-01, 01-02. Take 23:00-00:00 and grow it across midnight to 02:00.
    const { bookingId, slot } = await bookGame(3, 1);
    let end = new Date(slot.end);
    for (let step = 0; step < 4; step += 1) {
      await extend(bookingId, end); // 00:30, 01:00, 01:30, 02:00
      end = new Date(end.getTime() + THIRTY);
    }
    await expect(extend(bookingId, end)).rejects.toMatchObject({ key: expect.stringMatching(/extend_(closing|max)/) });
    const row = await rangeOf(bookingId);
    expect((row.end.getTime() - new Date(slot.start).getTime()) / 3_600_000).toBe(3);
  });

  it("refuses PENDING, REJECTED, CANCELLED and NO_SHOW bookings", async () => {
    for (const status of ["PENDING", "REJECTED", "CANCELLED", "NO_SHOW"] as const) {
      const { bookingId, slot } = await bookGame(3 + ["PENDING", "REJECTED", "CANCELLED", "NO_SHOW"].indexOf(status), 0);
      await platformDb.$executeRaw`UPDATE "Booking" SET status = ${status}::"BookingStatus" WHERE id = ${bookingId}`;
      await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "booking.extend_not_approved" });
    }
  });

  it("refuses a per-player booking", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await platformDb.$executeRaw`UPDATE "Booking" SET "collectionMode" = 'PER_PLAYER'::"CollectionMode" WHERE id = ${bookingId}`;
    await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "booking.extend_per_player" });
    expect((await rangeOf(bookingId)).end.getTime()).toBe(slot.endAt.getTime());
  });
});

describe("who may extend", () => {
  it("staff without bookings.extend are refused; with it they may, but not with a different price", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const plain = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, plain);
    await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "access.not_allowed" });

    const granted = await createStaffSession(fixture.tenantId, { "bookings.extend": true });
    actAs(fixture.tenantSlug, granted);
    await expect(extend(bookingId, slot.end, new Decimal("1.00"))).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(extend(bookingId, slot.end)).resolves.toBeDefined();
  });

  it("staff with bookings.extend and bookings.adjust_due may set the amount", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const token = await createStaffSession(fixture.tenantId, { "bookings.extend": true, "bookings.adjust_due": true });
    actAs(fixture.tenantSlug, token);
    const result = await extend(bookingId, slot.end, new Decimal("5.00"));
    expect(result.addedPriceUsd.toFixed(2)).toBe("5.00");
  });

  it("an unauthenticated call is refused", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    actAs(fixture.tenantSlug);
    await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("another stadium's owner cannot extend this booking", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other",
      ownerIdentifier: "owner@other-stadium",
    });
    actAs(other.tenantSlug, other.sessionId);
    await expect(extend(bookingId, slot.end)).rejects.toMatchObject({ key: "booking.not_found" });
    expect((await rangeOf(bookingId)).end.getTime()).toBe(slot.endAt.getTime());
  });

  it("the preview is empty without the permission and shows the offer with it", async () => {
    const { bookingId } = await bookGame(3, 0);
    const row = await rangeOf(bookingId);
    const game = {
      id: bookingId,
      status: "APPROVED",
      pitchId: fixture.pitchId,
      start: row.start,
      end: row.end,
      priceUsd: new Decimal(row.priceUsd),
      collectionMode: "WHOLE" as const,
    };
    const plain = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, plain);
    expect((await loadExtensionOffers([game])).size).toBe(0);

    actAsOwner();
    const offers = await loadExtensionOffers([game]);
    expect(offers.get(bookingId)).toMatchObject({ allowed: true, declineCount: 0 });
  });
});

describe("pending requests in the added time", () => {
  it("are declined and kept as interests, and the preview counts them", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    const next = await slotAt(3, 1); // 17:00-18:00 starts where the game ends
    const { bookingId: pendingId } = await requestPublicSlot({ ...next, name: "ليلى", phone: "03111009" });

    const row = await rangeOf(bookingId);
    const offers = await loadExtensionOffers([
      {
        id: bookingId,
        status: "APPROVED",
        pitchId: fixture.pitchId,
        start: row.start,
        end: row.end,
        priceUsd: new Decimal(row.priceUsd),
        collectionMode: "WHOLE",
      },
    ]);
    expect(offers.get(bookingId)?.declineCount).toBe(1);

    const result = await extend(bookingId, slot.end);
    expect(result.declined).toHaveLength(1);
    expect((await rangeOf(pendingId)).status).toBe("REJECTED");
    // The interest is on the added window only: [old end, old end + 30 minutes).
    const interests = await platformDb.$queryRaw<{ start: Date; end: Date }[]>`
      SELECT lower(during) AS start, upper(during) AS end FROM "SlotInterest" WHERE "pitchId" = ${fixture.pitchId}`;
    expect(interests).toHaveLength(1);
    expect(interests[0]!.start.getTime()).toBe(slot.endAt.getTime());
    expect(interests[0]!.end.getTime()).toBe(slot.endAt.getTime() + THIRTY);
    await expectNoOverlaps(fixture.pitchId);
  });
});

describe("the exclusion constraint is the backstop", () => {
  it("moving the end into another APPROVED game fails with 23P01", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await createOwnerBooking({ ...(await slotAt(3, 1)), name: "سامي", phone: "03111002" });

    const failure = await db
      .$transaction((tx) =>
        setBookingEndAndPrice(tx, {
          bookingId,
          newEnd: new Date(slot.endAt.getTime() + THIRTY),
          priceUsd: new Decimal("45.00"),
        }),
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(isExclusionViolation(failure)).toBe(true);
    expect((await rangeOf(bookingId)).end.getTime()).toBe(slot.endAt.getTime());
  });

  it("raw SQL cannot overlap either", async () => {
    const { bookingId, slot } = await bookGame(3, 0);
    await createOwnerBooking({ ...(await slotAt(3, 1)), name: "سامي", phone: "03111002" });
    const failure = await platformDb
      .$executeRaw`UPDATE "Booking" SET during = tstzrange(lower(during), ${new Date(slot.endAt.getTime() + THIRTY)}, '[)') WHERE id = ${bookingId}`.then(
      () => null,
      (error: unknown) => error,
    );
    expect(isExclusionViolation(failure)).toBe(true);
  });
});

describe("races (10 iterations each)", () => {
  it("extension x approve of the next slot: never an overlap", async () => {
    for (let i = 0; i < 10; i += 1) {
      const first = await slotAt(3 + i, 0);
      const second = await slotAt(3 + i, 1);
      const { bookingId } = await createOwnerBooking({ ...first, name: "هدى", phone: `0317${i}001` });
      const { bookingId: pendingId } = await requestPublicSlot({ ...second, name: "ليلى", phone: `0317${i}002` });

      const settled = await Promise.allSettled([extend(bookingId, first.end), approveBooking(pendingId)]);
      onlyDomainErrors(settled);
      await expectNoOverlaps(fixture.pitchId);
      const extended = (await rangeOf(bookingId)).end.getTime() > first.endAt.getTime();
      const pendingStatus = (await rangeOf(pendingId)).status;
      expect(extended && pendingStatus === "APPROVED").toBe(false);
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("extension x owner-create on the next slot: one wins, never an overlap", async () => {
    for (let i = 0; i < 10; i += 1) {
      const first = await slotAt(3 + i, 0);
      const second = await slotAt(3 + i, 1);
      const { bookingId } = await createOwnerBooking({ ...first, name: "هدى", phone: `0318${i}001` });

      const settled = await Promise.allSettled([
        extend(bookingId, first.end),
        createOwnerBooking({ ...second, name: "سامي", phone: `0318${i}002` }),
      ]);
      onlyDomainErrors(settled);
      expect(settled.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
      await expectNoOverlaps(fixture.pitchId);
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("extension x public request on the next slot: no pending request survives inside an approved game", async () => {
    for (let i = 0; i < 10; i += 1) {
      const first = await slotAt(3 + i, 0);
      const second = await slotAt(3 + i, 1);
      const { bookingId } = await createOwnerBooking({ ...first, name: "هدى", phone: `0319${i}001` });

      const settled = await Promise.allSettled([
        extend(bookingId, first.end),
        requestPublicSlot({ ...second, name: "ليلى", phone: `0319${i}002` }),
      ]);
      onlyDomainErrors(settled);
      await expectNoOverlaps(fixture.pitchId);
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("extension x cancel: either order ends consistent", async () => {
    for (let i = 0; i < 10; i += 1) {
      const { bookingId, slot } = await bookGame(3 + i, 0, `0320${i}001`);
      const settled = await Promise.allSettled([extend(bookingId, slot.end), cancelBooking({ bookingId, initiator: "OWNER" })]);
      onlyDomainErrors(settled);
      const row = await rangeOf(bookingId);
      expect(["APPROVED", "CANCELLED"]).toContain(row.status);
      if (row.status === "APPROVED") expect(row.amountDueUsd).toBe("45.00");
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("extension x collect: the due always ends at 45 and the money is not lost", async () => {
    for (let i = 0; i < 10; i += 1) {
      const { bookingId, slot } = await bookGame(3 + i, 0, `0321${i}001`);
      const settled = await Promise.allSettled([
        extend(bookingId, slot.end),
        collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: new Decimal("10.00") }] }),
      ]);
      onlyDomainErrors(settled);
      expect(settled.every((r) => r.status === "fulfilled")).toBe(true);
      expect((await rangeOf(bookingId)).amountDueUsd).toBe("45.00");
    }
    await assertMoneyInvariants([]);
  }, 120_000);

  it("extension x adjust due: both changes are logged in one unbroken chain", async () => {
    for (let i = 0; i < 10; i += 1) {
      const { bookingId, slot } = await bookGame(3 + i, 0, `0322${i}001`);
      const settled = await Promise.allSettled([
        extend(bookingId, slot.end),
        adjustBookingDue({ bookingId, toUsd: new Decimal("20.00"), reason: "DISCOUNT", note: null }),
      ]);
      onlyDomainErrors(settled);
      expect(settled.every((r) => r.status === "fulfilled")).toBe(true);
      // adjust last: 20; extend last: 20 + 15.
      expect(["20.00", "35.00"]).toContain((await rangeOf(bookingId)).amountDueUsd);
      const changes = await platformDb.bookingDueChange.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
      expect(changes).toHaveLength(2);
      expect(changes[1]!.fromUsd.toFixed(2)).toBe(changes[0]!.toUsd.toFixed(2));
    }
    await assertMoneyInvariants([]);
  }, 120_000);
});
