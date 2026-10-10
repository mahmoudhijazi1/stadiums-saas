import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import { platformDb } from "@/lib/platform-db";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { cancelRestOfSeries } from "@/modules/booking/application/cancel-rest-of-series";
import { extendBooking } from "@/modules/booking/application/extend-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { createSeries } from "@/modules/booking/application/create-series";
import { endingSoon, listWeeklyBookings } from "@/modules/booking/application/list-weekly-bookings";
import { makeWeekly } from "@/modules/booking/application/make-weekly";
import { previewMakeWeekly, previewNewSeries, previewRenewal } from "@/modules/booking/application/preview-series";
import { renewSeries } from "@/modules/booking/application/renew-series";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { anchorFromInstant, bookableCount, declineTotal, seriesOccurrences } from "@/modules/booking/domain/series";
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
 * Weekly recurring bookings. WRITTEN, NOT RUN when authored (the task forbade running suites):
 * treat every expectation as unverified until `npm run test:integration` has been run.
 *
 * The fixture pitch is open 16:00 to 22:00 every day, 60-minute games, $30. Slot index 0 is
 * 16:00-17:00 Beirut, index 4 is 20:00-21:00, index 5 is 21:00-22:00.
 */
const TIME_ZONE = "Asia/Beirut";
const WEEK_MS = 7 * 86_400_000;

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
  return { pitchId, start: slot.start, end: slot.end, startIso: slot.start.toISOString(), endIso: slot.end.toISOString() };
}

const PERSON = { name: "هدى", phone: "03111001" };

/** The starts of `count` weeks from `start`, by the stadium's calendar (not by adding 7 x 24 hours). */
function weekStarts(start: Date, count: number): Date[] {
  return seriesOccurrences(anchorFromInstant(start, TIME_ZONE), count, TIME_ZONE);
}

async function seriesGames(seriesId: string) {
  return platformDb.$queryRaw<
    { id: string; status: string; start: Date; end: Date; local: string; priceUsd: string; source: string }[]
  >`SELECT id, status::text AS status, lower(during) AS start, upper(during) AS end,
           to_char(lower(during) AT TIME ZONE 'Asia/Beirut', 'HH24:MI') AS local,
           "priceUsd"::text AS "priceUsd", source::text AS source
    FROM "Booking" WHERE "seriesId" = ${seriesId} ORDER BY lower(during)`;
}

async function startOf(bookingId: string) {
  const [row] = await platformDb.$queryRaw<{ start: Date; status: string }[]>`
    SELECT lower(during) AS start, status::text AS status FROM "Booking" WHERE id = ${bookingId}`;
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

async function newSeries(daysAhead: number, index: number, count: number, accepted?: Date[]) {
  const first = await slotAt(daysAhead, index);
  const preview = await previewNewSeries({
    pitchId: fixture.pitchId,
    anchorStart: first.start,
    durationMinutes: 60,
    count,
  });
  const starts = accepted ?? preview.items.filter((item) => item.state === "free").map((item) => item.start);
  return {
    first,
    preview,
    made: await createSeries({
      pitchId: fixture.pitchId,
      person: PERSON,
      anchorStart: first.start,
      durationMinutes: 60,
      count,
      acceptedStarts: starts,
    }),
  };
}

describe("creating a series", () => {
  it("creates one APPROVED owner booking per week, at the same local time, priced and frozen", async () => {
    const { made } = await newSeries(3, 4, 12); // 20:00-21:00, 12 weeks: crosses a clock change in some seasons
    expect(made.created).toHaveLength(12);
    expect(made.skipped).toHaveLength(0);

    const games = await seriesGames(made.seriesId);
    expect(games).toHaveLength(12);
    expect(new Set(games.map((game) => game.local))).toEqual(new Set(["20:00"]));
    expect(games.every((game) => game.status === "APPROVED" && game.source === "OWNER")).toBe(true);
    expect(games.every((game) => game.priceUsd === "30.00")).toBe(true);
    // One week apart on the stadium's calendar (the UTC gap may be 7 days +/- 1 hour at a clock change).
    for (let i = 1; i < games.length; i += 1) {
      const gap = games[i]!.start.getTime() - games[i - 1]!.start.getTime();
      expect(Math.abs(gap - WEEK_MS)).toBeLessThanOrEqual(3_600_000);
    }

    const series = await platformDb.bookingSeries.findUniqueOrThrow({ where: { id: made.seriesId } });
    expect(series).toMatchObject({ durationMinutes: 60, anchorTime: "20:00", pitchId: fixture.pitchId });
    expect(await platformDb.bookingParticipant.count({ where: { isRequester: true, booking: { seriesId: made.seriesId } } })).toBe(12);
    await assertMoneyInvariants([]);
  });

  it("keeps the local start time on both sides of the next Asia/Beirut clock change, whatever day the test runs", async () => {
    // The first clock change at least 15 days away; the series starts two weeks before it, so the
    // anchor is always in the future and the series crosses the change at its third game.
    const today = civilDateInTimeZone(new Date(), TIME_ZONE);
    const offsetAtNoon = (daysAhead: number) => {
      const day = addCalendarDays(today, daysAhead);
      const noon = new Date(Date.UTC(day.year, day.month - 1, day.day, 12));
      const part = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
        .formatToParts(noon)
        .find((p) => p.type === "timeZoneName")!.value;
      return part;
    };
    let changeDaysAhead = 15;
    while (offsetAtNoon(changeDaysAhead) === offsetAtNoon(changeDaysAhead - 1)) {
      changeDaysAhead += 1;
      if (changeDaysAhead > 500) throw new Error("no clock change found");
    }

    const { made } = await newSeries(changeDaysAhead - 14, 4, 4); // 20:00-21:00
    const games = await seriesGames(made.seriesId);
    expect(games).toHaveLength(4);
    expect(new Set(games.map((game) => game.local))).toEqual(new Set(["20:00"]));

    // Before the change the weeks are exactly 7 x 24 hours apart; across it they are 1 hour off.
    const gaps = games.slice(1).map((game, i) => game.start.getTime() - games[i]!.start.getTime());
    expect(gaps[0]).toBe(WEEK_MS);
    expect(Math.abs(gaps[1]! - WEEK_MS)).toBe(3_600_000);
  });

  it("keeps a game after midnight on the same local time every week", async () => {
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
    const { made } = await newSeries(3, 2, 8); // 00:00-01:00 the next day
    expect(made.created).toHaveLength(8);
    const games = await seriesGames(made.seriesId);
    expect(new Set(games.map((game) => game.local))).toEqual(new Set(["00:00"]));
  });

  it("creates nothing and says so when no week can be booked", async () => {
    const first = await slotAt(3, 5); // 21:00, closes 22:00: a two-hour series never fits
    const preview = await previewNewSeries({ pitchId: fixture.pitchId, anchorStart: first.start, durationMinutes: 120, count: 4 });
    expect(preview.items.every((item) => item.state === "outside_hours")).toBe(true);
    await expect(
      createSeries({
        pitchId: fixture.pitchId,
        person: PERSON,
        anchorStart: first.start,
        durationMinutes: 120,
        count: 4,
        acceptedStarts: preview.items.map((item) => item.start),
      }),
    ).rejects.toMatchObject({ key: "booking.series_none" });
    expect(await platformDb.bookingSeries.count()).toBe(0);
    expect(await platformDb.booking.count()).toBe(0);
  });

  it("a taken week is shown as taken in the preview and is not booked", async () => {
    const first = await slotAt(3, 0);
    const third = await slotAt(3 + 14, 0);
    await createOwnerBooking({ pitchId: fixture.pitchId, start: third.startIso, end: third.endIso, name: "سامي", phone: "03111002" });

    const preview = await previewNewSeries({ pitchId: fixture.pitchId, anchorStart: first.start, durationMinutes: 60, count: 4 });
    expect(preview.items.map((item) => item.state)).toEqual(["free", "free", "taken", "free"]);
    expect(bookableCount(preview.items)).toBe(3);

    const { made } = await newSeries(3, 0, 4);
    expect(made.created).toHaveLength(3);
    expect(await seriesGames(made.seriesId)).toHaveLength(3);
    await expectNoOverlaps(fixture.pitchId);
  });

  it("a week booked between the preview and the confirm is skipped and reported, never a failure", async () => {
    const first = await slotAt(3, 1);
    const preview = await previewNewSeries({ pitchId: fixture.pitchId, anchorStart: first.start, durationMinutes: 60, count: 8 });
    expect(bookableCount(preview.items)).toBe(8);

    const week2 = await slotAt(3 + 14, 1);
    await createOwnerBooking({ pitchId: fixture.pitchId, start: week2.startIso, end: week2.endIso, name: "سامي", phone: "03111002" });

    const made = await createSeries({
      pitchId: fixture.pitchId,
      person: PERSON,
      anchorStart: first.start,
      durationMinutes: 60,
      count: 8,
      acceptedStarts: preview.items.map((item) => item.start),
    });
    expect(made.created).toHaveLength(7);
    expect(made.skipped).toHaveLength(1);
    expect(made.skipped[0]).toMatchObject({ index: 2, reason: "taken" });
    expect(made.skipped[0]!.start.getTime()).toBe(week2.start.getTime());
    await expectNoOverlaps(fixture.pitchId);
  });

  it("pending requests on a created week are declined into interests, and the preview counts them", async () => {
    const first = await slotAt(3, 2);
    const week1 = await slotAt(3 + 7, 2);
    const { bookingId: pendingId } = await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: week1.startIso,
      end: week1.endIso,
      name: "ليلى",
      phone: "03111009",
    });

    const preview = await previewNewSeries({ pitchId: fixture.pitchId, anchorStart: first.start, durationMinutes: 60, count: 4 });
    expect(declineTotal(preview.items)).toBe(1);

    const { made } = await newSeries(3, 2, 4);
    expect(made.declined).toHaveLength(1);
    expect((await startOf(pendingId)).status).toBe("REJECTED");
    expect(await platformDb.slotInterest.count({ where: { pitchId: fixture.pitchId } })).toBe(1);
    await expectNoOverlaps(fixture.pitchId);
  });

  it("refuses a count outside 4, 8 and 12 and a week the owner never saw", async () => {
    const first = await slotAt(3, 0);
    await expect(
      createSeries({ pitchId: fixture.pitchId, person: PERSON, anchorStart: first.start, durationMinutes: 60, count: 6, acceptedStarts: [first.start] }),
    ).rejects.toMatchObject({ key: "form.invalid" });
    await expect(
      createSeries({
        pitchId: fixture.pitchId,
        person: PERSON,
        anchorStart: first.start,
        durationMinutes: 60,
        count: 4,
        acceptedStarts: [new Date(first.start.getTime() + 3_600_000)],
      }),
    ).rejects.toMatchObject({ key: "form.invalid" });
  });
});

describe("make weekly and renew", () => {
  it("makeWeekly links the original booking and creates the next weeks", async () => {
    const slot = await slotAt(3, 3);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });

    const preview = await previewMakeWeekly({ bookingId, count: 4 });
    expect(preview.items.map((item) => item.index)).toEqual([1, 2, 3, 4]);
    const made = await makeWeekly({ bookingId, count: 4, acceptedStarts: preview.items.map((item) => item.start) });

    expect(made.created).toHaveLength(4);
    const games = await seriesGames(made.seriesId);
    expect(games).toHaveLength(5);
    expect(games[0]!.id).toBe(bookingId);
    expect(new Set(games.map((game) => game.local)).size).toBe(1);
    await expect(makeWeekly({ bookingId, count: 4 })).rejects.toMatchObject({ key: "booking.series_exists" });
  });

  it("makeWeekly from a booking extended by 30 minutes creates standard-length weeks at the standard price and leaves the source extended", async () => {
    const slot = await slotAt(3, 3); // 19:00-20:00, the next 30 minutes are free
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });
    await extendBooking({ bookingId, expectedEndsAt: slot.end, addedPriceUsd: new Decimal("15") });

    const preview = await previewMakeWeekly({ bookingId, count: 4 });
    expect(preview.durationMinutes).toBe(60);
    expect(preview.items.every((item) => item.end.getTime() - item.start.getTime() === 3_600_000)).toBe(true);
    expect(preview.items.every((item) => item.priceUsd?.equals(30))).toBe(true);

    const made = await makeWeekly({ bookingId, count: 4, acceptedStarts: preview.items.map((item) => item.start) });
    expect(made.created).toHaveLength(4);

    const series = await platformDb.bookingSeries.findUniqueOrThrow({ where: { id: made.seriesId } });
    expect(series.durationMinutes).toBe(60);

    const games = await seriesGames(made.seriesId);
    expect(games).toHaveLength(5);
    // The source keeps its extended range and price; every new week is the standard game.
    expect(games[0]!.id).toBe(bookingId);
    expect(games[0]!.end.getTime() - games[0]!.start.getTime()).toBe(90 * 60_000);
    expect(games[0]!.priceUsd).toBe("45.00");
    for (const game of games.slice(1)) {
      expect(game.end.getTime() - game.start.getTime()).toBe(60 * 60_000);
      expect(game.priceUsd).toBe("30.00");
    }
    await expectNoOverlaps(fixture.pitchId);
  });

  it("makeWeekly refuses a booking that is not APPROVED", async () => {
    const slot = await slotAt(3, 3);
    const { bookingId } = await requestPublicSlot({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "ليلى", phone: "03111009" });
    await expect(makeWeekly({ bookingId, count: 4 })).rejects.toMatchObject({ key: "booking.confirmed_only" });
  });

  it("renew continues after the last week, with no gap and no duplicate", async () => {
    const { made } = await newSeries(3, 1, 4);
    const before = await seriesGames(made.seriesId);
    const preview = await previewRenewal({ seriesId: made.seriesId, count: 4 });
    expect(preview.items.map((item) => item.index)).toEqual([4, 5, 6, 7]);

    const renewed = await renewSeries({ seriesId: made.seriesId, count: 4, acceptedStarts: preview.items.map((item) => item.start) });
    expect(renewed.created).toHaveLength(4);
    const after = await seriesGames(made.seriesId);
    expect(after).toHaveLength(8);
    expect(after[4]!.start.getTime() - before[3]!.start.getTime()).toBeGreaterThan(WEEK_MS - 3_600_000);
    expect(new Set(after.map((game) => game.start.getTime())).size).toBe(8);

    // And again.
    expect((await renewSeries({ seriesId: made.seriesId, count: 4 })).created).toHaveLength(4);
    expect(await seriesGames(made.seriesId)).toHaveLength(12);
    await expectNoOverlaps(fixture.pitchId);
  });
});

describe("an extension belongs to one week only", () => {
  it("renew after the last week was extended continues at the standard length and price", async () => {
    const { made } = await newSeries(3, 3, 4);
    const before = await seriesGames(made.seriesId);
    const last = before[3]!;
    await extendBooking({ bookingId: last.id, expectedEndsAt: last.end, addedPriceUsd: new Decimal("15") });

    const preview = await previewRenewal({ seriesId: made.seriesId, count: 4 });
    expect(preview.durationMinutes).toBe(60);
    const renewed = await renewSeries({ seriesId: made.seriesId, count: 4, acceptedStarts: preview.items.map((item) => item.start) });
    expect(renewed.created).toHaveLength(4);

    const after = await seriesGames(made.seriesId);
    expect(after).toHaveLength(8);
    expect(after[3]!.end.getTime() - after[3]!.start.getTime()).toBe(90 * 60_000); // still extended
    for (const game of [...after.slice(0, 3), ...after.slice(4)]) {
      expect(game.end.getTime() - game.start.getTime()).toBe(60 * 60_000);
      expect(game.priceUsd).toBe("30.00");
    }
    const series = await platformDb.bookingSeries.findUniqueOrThrow({ where: { id: made.seriesId } });
    expect(series.durationMinutes).toBe(60);
  });

  it("createSeries from the quick booking is unchanged: it uses the length it is given", async () => {
    const { made } = await newSeries(3, 1, 4);
    const games = await seriesGames(made.seriesId);
    expect(games.every((game) => game.end.getTime() - game.start.getTime() === 3_600_000)).toBe(true);
    expect((await platformDb.bookingSeries.findUniqueOrThrow({ where: { id: made.seriesId } })).durationMinutes).toBe(60);
  });
});

describe("cancel the rest", () => {
  it("cancels upcoming weeks with no fee, leaves started and paid weeks alone", async () => {
    const { made } = await newSeries(3, 0, 4);
    const games = await seriesGames(made.seriesId);

    // Week 0 has started (moved to the past), week 2 has a payment.
    await platformDb.$executeRaw`UPDATE "Booking"
      SET during = tstzrange(now() - interval '2 hours', now() - interval '1 hour', '[)') WHERE id = ${games[0]!.id}`;
    await collectBookingPayment({ bookingId: games[2]!.id, tenders: [{ currency: "USD", amount: new Decimal("10.00") }] });

    const done = await cancelRestOfSeries({ seriesId: made.seriesId });
    expect(done.cancelled.map((week) => week.bookingId).sort()).toEqual([games[1]!.id, games[3]!.id].sort());
    expect(done.kept.map((week) => week.bookingId)).toEqual([games[2]!.id]);
    expect(done.kept[0]!.collectedUsd.toFixed(2)).toBe("10.00");

    const after = await seriesGames(made.seriesId);
    const byId = new Map(after.map((game) => [game.id, game.status]));
    expect(byId.get(games[0]!.id)).toBe("APPROVED"); // started: not touched
    expect(byId.get(games[1]!.id)).toBe("CANCELLED");
    expect(byId.get(games[2]!.id)).toBe("APPROVED"); // paid: cancel one by one
    expect(byId.get(games[3]!.id)).toBe("CANCELLED");

    // No fee: the due goes to zero with a CANCELLATION_NO_FEE row.
    const cancelled = await platformDb.booking.findUniqueOrThrow({ where: { id: games[1]!.id } });
    expect(cancelled.amountDueUsd.toFixed(2)).toBe("0.00");
    const change = await platformDb.bookingDueChange.findFirstOrThrow({ where: { bookingId: games[1]!.id } });
    expect(change.reason).toBe("CANCELLATION_NO_FEE");
    await assertMoneyInvariants([]);
  });

  it("is safe to run twice", async () => {
    const { made } = await newSeries(3, 0, 4);
    expect((await cancelRestOfSeries({ seriesId: made.seriesId })).cancelled).toHaveLength(4);
    expect((await cancelRestOfSeries({ seriesId: made.seriesId })).cancelled).toHaveLength(0);
  });
});

describe("the Today reminder and the list", () => {
  it("a series with 3 games left is not ending soon; with 2 left it is", async () => {
    const { made } = await newSeries(3, 0, 4);
    const games = await seriesGames(made.seriesId);

    expect(endingSoon(await listWeeklyBookings())).toHaveLength(0);
    expect((await listWeeklyBookings())[0]).toMatchObject({ seriesId: made.seriesId, left: 4 });

    await cancelBooking({ bookingId: games[0]!.id, initiator: "OWNER" });
    expect((await listWeeklyBookings())[0]!.left).toBe(3);
    expect(endingSoon(await listWeeklyBookings())).toHaveLength(0);

    await cancelBooking({ bookingId: games[1]!.id, initiator: "OWNER" });
    const soon = endingSoon(await listWeeklyBookings());
    expect(soon).toHaveLength(1);
    expect(soon[0]).toMatchObject({ seriesId: made.seriesId, left: 2, personName: PERSON.name });
  });

  it("filters by person and drops a series with no games left", async () => {
    const { made } = await newSeries(3, 0, 4);
    const person = await platformDb.bookingSeries.findUniqueOrThrow({ where: { id: made.seriesId } });
    expect(await listWeeklyBookings({ personId: person.personId })).toHaveLength(1);
    expect(await listWeeklyBookings({ personId: "nobody" })).toHaveLength(0);

    await cancelRestOfSeries({ seriesId: made.seriesId });
    expect(await listWeeklyBookings()).toHaveLength(0);
  });
});

describe("who may", () => {
  it("creating, renewing and making weekly need bookings.create; cancelling the rest needs bookings.cancel", async () => {
    const { made } = await newSeries(3, 0, 4);
    const slot = await slotAt(20, 0);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "سامي", phone: "03111002" });

    const plain = await createStaffSession(fixture.tenantId, {});
    actAs(fixture.tenantSlug, plain);
    const first = await slotAt(40, 0);
    await expect(
      createSeries({ pitchId: fixture.pitchId, person: PERSON, anchorStart: first.start, durationMinutes: 60, count: 4, acceptedStarts: [first.start] }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(renewSeries({ seriesId: made.seriesId, count: 4 })).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(makeWeekly({ bookingId, count: 4 })).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(cancelRestOfSeries({ seriesId: made.seriesId })).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(previewNewSeries({ pitchId: fixture.pitchId, anchorStart: first.start, durationMinutes: 60, count: 4 })).rejects.toMatchObject({
      key: "access.not_allowed",
    });

    const creator = await createStaffSession(fixture.tenantId, { "bookings.create": true });
    actAs(fixture.tenantSlug, creator);
    await expect(renewSeries({ seriesId: made.seriesId, count: 4 })).resolves.toBeDefined();
    await expect(cancelRestOfSeries({ seriesId: made.seriesId })).rejects.toMatchObject({ key: "access.not_allowed" });

    const canceller = await createStaffSession(fixture.tenantId, { "bookings.cancel": true });
    actAs(fixture.tenantSlug, canceller);
    await expect(cancelRestOfSeries({ seriesId: made.seriesId })).resolves.toBeDefined();
  });

  it("an unauthenticated call is refused", async () => {
    const first = await slotAt(3, 0);
    actAs(fixture.tenantSlug);
    await expect(
      createSeries({ pitchId: fixture.pitchId, person: PERSON, anchorStart: first.start, durationMinutes: 60, count: 4, acceptedStarts: [first.start] }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("another stadium's owner cannot use this stadium's pitch or series", async () => {
    const { made } = await newSeries(3, 0, 4);
    const other = await seriesOtherTenant();
    actAs(other.tenantSlug, other.sessionId);
    const first = await slotAt(3, 0);
    await expect(
      createSeries({ pitchId: fixture.pitchId, person: PERSON, anchorStart: first.start, durationMinutes: 60, count: 4, acceptedStarts: [first.start] }),
    ).rejects.toMatchObject({ key: "booking.pitch_not_found" });
    await expect(renewSeries({ seriesId: made.seriesId, count: 4 })).rejects.toMatchObject({ key: "booking.series_not_found" });
    await expect(cancelRestOfSeries({ seriesId: made.seriesId })).rejects.toMatchObject({ key: "booking.series_not_found" });
    expect(await seriesGames(made.seriesId)).toHaveLength(4);
  });
});

async function seriesOtherTenant() {
  return seedMinimalFixture({ tenantSlug: "other-stadium", tenantName: "Other", ownerIdentifier: "owner@other-stadium" });
}

describe("races (10 iterations each)", () => {
  it("createSeries x owner-create on one of its weeks: never an overlap", async () => {
    for (let i = 0; i < 10; i += 1) {
      // 28 days apart so one iteration's four weeks never touch another's.
      const first = await slotAt(3 + i * 28, 0);
      const week2 = await slotAt(3 + i * 28 + 14, 0);
      const settled = await Promise.allSettled([
        createSeries({
          pitchId: fixture.pitchId,
          person: { name: "هدى", phone: `0330${i}001` },
          anchorStart: first.start,
          durationMinutes: 60,
          count: 4,
          acceptedStarts: weekStarts(first.start, 4),
        }),
        createOwnerBooking({ pitchId: fixture.pitchId, start: week2.startIso, end: week2.endIso, name: "سامي", phone: `0331${i}002` }),
      ]);
      onlyDomainErrors(settled);
      expect(settled.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
      await expectNoOverlaps(fixture.pitchId);
    }
    await assertMoneyInvariants([]);
  }, 180_000);

  it("createSeries x approve of a pending request on one of its weeks: never an overlap", async () => {
    for (let i = 0; i < 10; i += 1) {
      // 28 days apart so one iteration's four weeks never touch another's.
      const first = await slotAt(3 + i * 28, 1);
      const week1 = await slotAt(3 + i * 28 + 7, 1);
      const { bookingId: pendingId } = await requestPublicSlot({
        pitchId: fixture.pitchId,
        start: week1.startIso,
        end: week1.endIso,
        name: "ليلى",
        phone: `0332${i}001`,
      });
      const settled = await Promise.allSettled([
        createSeries({
          pitchId: fixture.pitchId,
          person: { name: "هدى", phone: `0333${i}002` },
          anchorStart: first.start,
          durationMinutes: 60,
          count: 4,
          acceptedStarts: weekStarts(first.start, 4),
        }),
        approveBooking(pendingId),
      ]);
      onlyDomainErrors(settled);
      await expectNoOverlaps(fixture.pitchId);
    }
    await assertMoneyInvariants([]);
  }, 180_000);
});
