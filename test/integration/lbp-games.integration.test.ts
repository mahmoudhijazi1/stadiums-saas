import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { platformDb } from "@/lib/platform-db";
import { formatPrice } from "@/lib/format/money";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { createSeries } from "@/modules/booking/application/create-series";
import { listPersonBookings } from "@/modules/booking/application/list-person-bookings";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { anchorFromInstant, seriesOccurrences } from "@/modules/booking/domain/series";
import {
  addCalendarDays,
  civilDateInTimeZone,
  formatCivilDate,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig, type ScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 5: games priced in pounds. WRITTEN, NOT RUN when authored (the task forbade running
 * suites): treat every expectation as unverified until `npm run test:integration` has been run.
 *
 * The fixture pitch is open 16:00 to 22:00 every day, 60-minute games. Here it gets 2,000,000 LBP as
 * its default, a 18:00-20:00 rule with 2,500,000 LBP (and $35), and a 20:00-22:00 rule with only
 * dollars ($40). Slot index 0 is 16:00, index 2 is 18:00, index 4 is 20:00 (Beirut).
 */
const TIME_ZONE = "Asia/Beirut";
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const LBP_REFUSED = { key: "booking.lbp_not_supported" };
const NO_PRICE = { key: "booking.no_price_in_currency" };

let fixture: TestFixture;

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  await priceGamesIn("LBP");
  await setPitchPrices({
    defaultPriceLbp: "2000000",
    priceRules: [
      { days: [...ALL_DAYS], start: "18:00", end: "20:00", priceUsd: "35.00", priceLbp: "2500000" },
      { days: [...ALL_DAYS], start: "20:00", end: "22:00", priceUsd: "40.00" },
    ],
  });
  actAsOwner();
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

function actAsOwner() {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
}

function actAsPublic() {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
}

async function priceGamesIn(currency: "USD" | "LBP") {
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: { settings: { perPlayerSplitEnabled: true, gamePriceCurrency: currency } },
  });
  clearReactCache();
}

async function setPitchPrices(prices: Partial<Pick<ScheduleConfig, "defaultPriceLbp" | "priceRules">>) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const config = parseScheduleConfig(pitch.scheduleConfig);
  const next: Record<string, unknown> = { ...config, ...prices };
  if (!("defaultPriceLbp" in prices)) next.defaultPriceLbp = config.defaultPriceLbp;
  if (next.defaultPriceLbp === undefined) delete next.defaultPriceLbp;
  await platformDb.pitch.update({ where: { id: fixture.pitchId }, data: { scheduleConfig: parseScheduleConfig(next) } });
}

async function slotAt(daysAhead: number, index: number) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slot = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  })[index];
  if (!slot) throw new Error(`no slot ${index} at +${daysAhead}`);
  return { day, start: slot.start, end: slot.end, startIso: slot.start.toISOString(), endIso: slot.end.toISOString() };
}

const PERSON = { name: "هدى", phone: "9613111001" };

/** The money columns of a booking and of its requester, as text. */
async function moneyOf(bookingId: string) {
  const [booking] = await platformDb.$queryRaw<
    { priceCurrency: string; priceUsd: string | null; amountDueUsd: string | null; priceLbp: string | null; amountDueLbp: string | null; status: string }[]
  >`SELECT "priceCurrency"::text AS "priceCurrency", "priceUsd"::text AS "priceUsd", "amountDueUsd"::text AS "amountDueUsd",
           "priceLbp"::text AS "priceLbp", "amountDueLbp"::text AS "amountDueLbp", status::text AS status
    FROM "Booking" WHERE id = ${bookingId}`;
  const participant = await platformDb.bookingParticipant.findFirstOrThrow({ where: { bookingId, isRequester: true } });
  return {
    booking,
    participant: {
      personId: participant.personId,
      amountDueUsd: participant.amountDueUsd?.toString() ?? null,
      amountDueLbp: participant.amountDueLbp?.toString() ?? null,
    },
  };
}

function expectLbpGame(money: Awaited<ReturnType<typeof moneyOf>>, pounds: string) {
  expect(money.booking).toMatchObject({
    priceCurrency: "LBP",
    priceUsd: null,
    amountDueUsd: null,
    priceLbp: pounds,
    amountDueLbp: pounds,
  });
  expect(money.participant).toMatchObject({ amountDueUsd: null, amountDueLbp: pounds });
}

describe("creating games in an LBP stadium", () => {
  it("an owner booking stores the LBP columns (the CHECKs accept it) and no dollars", async () => {
    const slot = await slotAt(2, 0);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });
    expectLbpGame(await moneyOf(bookingId), "2000000");
    expect((await moneyOf(bookingId)).booking?.status).toBe("APPROVED");
    await assertMoneyInvariants([]);
  });

  it("a matching rule in pounds sets the price", async () => {
    const slot = await slotAt(2, 2);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });
    expectLbpGame(await moneyOf(bookingId), "2500000");
  });

  it("a slot whose rule has no LBP price uses the default LBP price", async () => {
    const slot = await slotAt(2, 4);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });
    expectLbpGame(await moneyOf(bookingId), "2000000");
  });

  it("a public request stores the LBP columns", async () => {
    const slot = await slotAt(3, 0);
    actAsPublic();
    const { bookingId } = await requestPublicSlot({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "ليلى", phone: "9613111002" });
    const money = await moneyOf(bookingId);
    expectLbpGame(money, "2000000");
    expect(money.booking?.status).toBe("PENDING");
  });

  it("approving an LBP request works and rejects an overlapping LBP request into an interest", async () => {
    const slot = await slotAt(3, 1);
    actAsPublic();
    const first = await requestPublicSlot({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "ليلى", phone: "9613111003" });
    const second = await requestPublicSlot({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "سامي", phone: "9613111004" });
    actAsOwner();
    const rejected = await approveBooking(first.bookingId);
    expect(rejected.map((person) => person.phone)).toEqual(["9613111004"]);
    const approved = await moneyOf(first.bookingId);
    expect(approved.booking?.status).toBe("APPROVED");
    // Status only: the price stays as it was booked.
    expectLbpGame(approved, "2000000");
    expect((await moneyOf(second.bookingId)).booking?.status).toBe("REJECTED");
    expect(await platformDb.slotInterest.count({ where: { pitchId: fixture.pitchId } })).toBe(1);
    await assertMoneyInvariants([]);
  });

  it("rejecting an LBP request works", async () => {
    const slot = await slotAt(3, 3);
    actAsPublic();
    const { bookingId } = await requestPublicSlot({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "ليلى", phone: "9613111005" });
    actAsOwner();
    await rejectBooking(bookingId);
    expect((await moneyOf(bookingId)).booking?.status).toBe("REJECTED");
  });

  it("creates a weekly series of 6 games in pounds (8 weeks offered, 6 accepted)", async () => {
    const slot = await slotAt(2, 0);
    const starts = seriesOccurrences(anchorFromInstant(slot.start, TIME_ZONE), 8, TIME_ZONE);
    const created = await createSeries({
      pitchId: fixture.pitchId,
      person: PERSON,
      anchorStart: slot.start,
      durationMinutes: 60,
      count: 8,
      acceptedStarts: starts.slice(0, 6),
    });
    expect(created.created).toHaveLength(6);
    for (const week of created.created) {
      expectLbpGame(await moneyOf(week.bookingId), "2000000");
    }
    await assertMoneyInvariants([]);
  });

  it("refuses a pitch with no LBP price, writing nothing", async () => {
    await setPitchPrices({ defaultPriceLbp: undefined, priceRules: [] });
    const slot = await slotAt(2, 0);
    await expect(
      createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON }),
    ).rejects.toMatchObject(NO_PRICE);
    actAsPublic();
    await expect(
      requestPublicSlot({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, name: "ليلى", phone: "9613111006" }),
    ).rejects.toMatchObject(NO_PRICE);
    actAsOwner();
    await expect(
      createSeries({ pitchId: fixture.pitchId, person: PERSON, anchorStart: slot.start, durationMinutes: 60, count: 4, acceptedStarts: [slot.start] }),
    ).rejects.toMatchObject(NO_PRICE);
    expect(await platformDb.booking.count()).toBe(0);
    expect(await platformDb.bookingSeries.count()).toBe(0);
  });

  it("collecting on an LBP game is refused with booking.lbp_not_supported", async () => {
    const slot = await slotAt(2, 0);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });
    await expect(
      collectBookingPayment({ bookingId, tenders: [{ currency: "LBP", amount: new Decimal("2000000") }] }),
    ).rejects.toMatchObject(LBP_REFUSED);
    expect(await platformDb.payment.count()).toBe(0);
    await assertMoneyInvariants([]);
  });
});

describe("showing an LBP game", () => {
  it("Today, the booking sheet and the person page show 2,000,000 LBP", async () => {
    const slot = await slotAt(2, 0);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });

    const day = await loadOwnerDay(formatCivilDate(slot.day));
    const game = day.games.find((row) => row.id === bookingId);
    expect(game?.currency).toBe("LBP");
    if (game?.currency !== "LBP") throw new Error("expected an LBP game");
    expect(game.amountDueLbp.toFixed(0)).toBe("2000000");

    const view = lbpUpcomingView(game, {
      items: undefined,
      itemsPanel: { tabsOwed: false, bookerPersonId: game.requesterPersonId, bookerName: game.requesterName, tabs: [] },
      now: new Date(),
      locale: "en",
      hourCycle: "h23",
      openWaitlist: [],
      stadiumName: "Test Stadium",
      showPitch: false,
      dayStartHour: 6,
      extendedMinutes: 0,
      series: undefined,
    });
    expect(view.lbp).toEqual({ due: "2,000,000 LBP", pill: "2,000,000 LBP" });
    // Money actions stay refused until their slices: hidden, not offered.
    expect([view.showCancel, view.showNoShow, view.canAdjust, view.mayAddItems, view.repeatWeekly]).toEqual([
      false, false, false, false, false,
    ]);
    expect(view.extend).toBeNull();
    expect(view.perPlayer.canSplit).toBe(false);

    const { rows } = await listPersonBookings((await moneyOf(bookingId)).participant.personId, null);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountDue).toEqual({ currency: "LBP", amount: new Decimal(2000000) });
    expect(formatPrice(rows[0]!.amountDue, "en")).toBe("2,000,000 LBP");
    expect(formatPrice(rows[0]!.price, "ar")).toBe("2,000,000 ل.ل");
  });
});

describe("a USD stadium books exactly as before", () => {
  it("stores the USD columns and no pounds", async () => {
    await priceGamesIn("USD");
    const slot = await slotAt(2, 0);
    const { bookingId } = await createOwnerBooking({ pitchId: fixture.pitchId, start: slot.startIso, end: slot.endIso, ...PERSON });
    const money = await moneyOf(bookingId);
    expect(money.booking).toMatchObject({ priceCurrency: "USD", priceUsd: "30.00", amountDueUsd: "30.00", priceLbp: null, amountDueLbp: null });
    expect(money.participant).toMatchObject({ amountDueUsd: "30", amountDueLbp: null });
    await assertMoneyInvariants([money.participant.personId]);
  });
});
