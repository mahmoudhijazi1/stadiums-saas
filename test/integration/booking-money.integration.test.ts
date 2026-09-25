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
import { getPersonBookingStats } from "@/modules/booking/application/get-person-booking-stats";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import { bookingRemaining } from "@/modules/payment/domain/collect";
import {
  findOrCreatePerson,
} from "@/modules/people/application/find-or-create-person";
import { getPerson } from "@/modules/people/application/get-person";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import {
  addCalendarDays,
  civilDateInTimeZone,
  formatCivilDate,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
  type ScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;

describe("booking and money", () => {
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

  it("approves one public request and rejects the other with a slot interest", async () => {
    const slot = await eveningSlot(fixture.pitchId, 3);
    const winnerId = await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "ليلى",
      phone: "03111001",
    }).then((result) => result.bookingId);
    await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "سامي",
      phone: "03111002",
    });

    const winner = await personByPhone(fixture.tenantId, "03111001");
    const loser = await personByPhone(fixture.tenantId, "03111002");
    const rejected = await approveBooking(winnerId);

    expect(rejected.map((person) => person.personId)).toContain(loser.id);
    const loserBooking = await platformDb.booking.findFirstOrThrow({
      where: { tenantId: fixture.tenantId, status: "REJECTED" },
      select: { status: true },
    });
    expect(loserBooking.status).toBe("REJECTED");
    const interests = await platformDb.slotInterest.findMany({
      where: { personId: loser.id },
      select: { id: true },
    });
    expect(interests).toHaveLength(1);
    const winnerBooking = await platformDb.booking.findUniqueOrThrow({
      where: { id: winnerId },
      select: { status: true },
    });
    expect(winnerBooking.status).toBe("APPROVED");

    await assertMoneyInvariants([winner.id, loser.id]);
  });

  it("approves one of two concurrent requests, ten times", async () => {
    const personIds: string[] = [];

    for (let i = 0; i < 10; i += 1) {
      const slot = await eveningSlot(fixture.pitchId, 3 + i);
      const phoneA = `0314${i}001`;
      const phoneB = `0314${i}002`;
      const idA = await requestPublicSlot({
        pitchId: fixture.pitchId,
        start: slot.start,
        end: slot.end,
        name: `أحمد${i}`,
        phone: phoneA,
      }).then((result) => result.bookingId);
      const idB = await requestPublicSlot({
        pitchId: fixture.pitchId,
        start: slot.start,
        end: slot.end,
        name: `كريم${i}`,
        phone: phoneB,
      }).then((result) => result.bookingId);

      const settled = await Promise.allSettled([
        approveBooking(idA),
        approveBooking(idB),
      ]);
      const fulfilled = settled.filter((result) => result.status === "fulfilled");
      const rejected = settled.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = rejected[0]?.status === "rejected" ? rejected[0].reason : null;
      expect(reason).toBeInstanceOf(DomainError);
      expect((reason as DomainError).key).toBe("booking.no_longer_pending");
      expect(JSON.stringify(reason)).not.toContain("P2034");

      const rowA = await platformDb.booking.findUniqueOrThrow({
        where: { id: idA },
        select: { status: true },
      });
      const rowB = await platformDb.booking.findUniqueOrThrow({
        where: { id: idB },
        select: { status: true },
      });
      const statuses = [rowA.status, rowB.status].sort();
      expect(statuses).toEqual(["APPROVED", "REJECTED"]);

      const loserPhone = rowA.status === "REJECTED" ? phoneA : phoneB;
      const loser = await personByPhone(fixture.tenantId, loserPhone);
      const winner = await personByPhone(
        fixture.tenantId,
        loserPhone === phoneA ? phoneB : phoneA,
      );
      const interests = await platformDb.slotInterest.findMany({
        where: { personId: loser.id },
        select: { id: true },
      });
      expect(interests).toHaveLength(1);
      personIds.push(loser.id, winner.id);
    }

    await assertMoneyInvariants(personIds);
  }, 60_000);

  it("rejects a second overlapping APPROVED insert on the exclusion constraint", async () => {
    const slot = await eveningSlot(fixture.pitchId, 14);
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    await platformDb.$executeRaw`
      INSERT INTO "Booking" (
        "id", "tenantId", "pitchId", "during", "status", "source",
        "priceUsd", "amountDueUsd", "collectionMode"
      )
      VALUES (
        ${firstId},
        ${fixture.tenantId},
        ${fixture.pitchId},
        tstzrange(${slot.startAt}, ${slot.endAt}, '[)'),
        'APPROVED'::"BookingStatus",
        'OWNER'::"BookingSource",
        30.00,
        30.00,
        'WHOLE'::"CollectionMode"
      )
    `;

    let caught: unknown;
    try {
      await platformDb.$executeRaw`
        INSERT INTO "Booking" (
          "id", "tenantId", "pitchId", "during", "status", "source",
          "priceUsd", "amountDueUsd", "collectionMode"
        )
        VALUES (
          ${secondId},
          ${fixture.tenantId},
          ${fixture.pitchId},
          tstzrange(${slot.startAt}, ${slot.endAt}, '[)'),
          'APPROVED'::"BookingStatus",
          'OWNER'::"BookingSource",
          30.00,
          30.00,
          'WHOLE'::"CollectionMode"
        )
      `;
    } catch (error) {
      caught = error;
    }

    expect(isExclusionViolation(caught)).toBe(true);
    const approved = await platformDb.booking.count({
      where: { pitchId: fixture.pitchId, status: "APPROVED" },
    });
    expect(approved).toBe(1);
    await assertMoneyInvariants([]);
  });

  it("creates an owner booking approved at the pitch price", async () => {
    const slot = await eveningSlot(fixture.pitchId, 3);
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "هدى",
      phone: "03111005",
    });
    const person = await personByPhone(fixture.tenantId, "03111005");
    const booking = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(booking.status).toBe("APPROVED");
    expect(money(booking.amountDueUsd).equals(money(booking.priceUsd))).toBe(true);
    expect(money(booking.amountDueUsd).equals("30.00")).toBe(true);

    await assertMoneyInvariants([person.id]);
  });

  it("charges a late player cancel, opens the interest, then closes it", async () => {
    await setLateCancelFee(fixture.tenantId);
    const slot = await eveningSlot(fixture.pitchId, 5);
    const winnerId = await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "نور",
      phone: "03111006",
    }).then((result) => result.bookingId);
    await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "رامي",
      phone: "03111007",
    });
    const winner = await personByPhone(fixture.tenantId, "03111006");
    const waiting = await personByPhone(fixture.tenantId, "03111007");
    await approveBooking(winnerId);

    await cancelBooking({ bookingId: winnerId, initiator: "PLAYER" });

    const cancelled = await platformDb.booking.findUniqueOrThrow({
      where: { id: winnerId },
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(money(cancelled.amountDueUsd).equals("15.00")).toBe(true);
    const dueChange = await platformDb.bookingDueChange.findFirstOrThrow({
      where: { bookingId: winnerId },
      orderBy: { createdAt: "desc" },
    });
    expect(money(dueChange.toUsd).equals("15.00")).toBe(true);

    const open = await listOpenWaitlist();
    expect(open.some((group) => group.people.some((person) => person.personId === waiting.id))).toBe(
      true,
    );
    const stillApproved = await platformDb.booking.count({
      where: { pitchId: fixture.pitchId, status: "APPROVED" },
    });
    expect(stillApproved).toBe(0);

    await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "مالك",
      phone: "03111008",
    });
    const owner = await personByPhone(fixture.tenantId, "03111008");
    const closed = await listOpenWaitlist();
    expect(
      closed.some((group) => group.people.some((person) => person.personId === waiting.id)),
    ).toBe(false);

    await assertMoneyInvariants([winner.id, waiting.id, owner.id]);
  });

  it("lets the owner cancel a paid game with due equal to collected", async () => {
    const slot = await eveningSlot(fixture.pitchId, 3);
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "فادي",
      phone: "03111009",
    });
    const person = await personByPhone(fixture.tenantId, "03111009");
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("30.00") }],
    });

    await cancelBooking({ bookingId, initiator: "OWNER" });

    const booking = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    const collected = await collectedUsd(bookingId);
    expect(booking.status).toBe("CANCELLED");
    expect(money(booking.amountDueUsd).equals(collected)).toBe(true);
    expect(bookingRemaining(money(booking.amountDueUsd), collected).equals(0)).toBe(true);

    await assertMoneyInvariants([person.id]);
  });

  it("collects USD and LBP at a frozen rate as one ledger IN", async () => {
    const slot = await eveningSlot(fixture.pitchId, 3);
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "لينا",
      phone: "03111010",
    });
    const person = await personByPhone(fixture.tenantId, "03111010");
    await setExchangeRate(new Decimal(90000));
    await collectBookingPayment({
      bookingId,
      tenders: [
        { currency: "USD", amount: new Decimal("20.00") },
        { currency: "LBP", amount: new Decimal(900000) },
      ],
    });

    const payment = await platformDb.payment.findFirstOrThrow({
      where: { sourceId: bookingId, sourceType: "BOOKING" },
      include: { tenders: true },
    });
    expect(payment.tenders).toHaveLength(2);
    const usdTender = payment.tenders.find((tender) => tender.currency === "USD");
    const lbpTender = payment.tenders.find((tender) => tender.currency === "LBP");
    expect(money(usdTender?.usdEquivalent).equals("20.00")).toBe(true);
    expect(money(lbpTender?.usdEquivalent).equals("10.00")).toBe(true);
    expect(money(lbpTender?.rateAtTime).equals(90000)).toBe(true);
    expect(money(usdTender?.rateAtTime).equals(90000)).toBe(true);

    const ledger = await platformDb.ledgerEntry.findMany({
      where: { sourceId: bookingId, sourceType: "BOOKING", direction: "IN" },
    });
    expect(ledger).toHaveLength(1);
    expect(money(ledger[0]?.amountUsd).equals("30.00")).toBe(true);

    const booking = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(bookingRemaining(money(booking.amountDueUsd), new Decimal("30.00")).equals(0)).toBe(
      true,
    );

    await assertMoneyInvariants([person.id]);
  });

  it("collects a cancellation fee and drops it from owed", async () => {
    await setLateCancelFee(fixture.tenantId);
    const slot = await eveningSlot(fixture.pitchId, 6);
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "تالا",
      phone: "03111011",
    });
    const person = await personByPhone(fixture.tenantId, "03111011");
    await cancelBooking({ bookingId, initiator: "PLAYER" });
    const before = await getPersonBookingStats(person.id);
    expect(before.owesNowUsd.equals("15.00")).toBe(true);

    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("15.00") }],
    });

    const after = await getPersonBookingStats(person.id);
    expect(after.owesNowUsd.equals(0)).toBe(true);
    await assertMoneyInvariants([person.id]);
  });

  it("records a no-show fee then a waiver with no ledger row", async () => {
    const slot = await eveningSlot(fixture.pitchId, -2);
    const seeded = await db.$transaction(async (tx) => {
      const person = await findOrCreatePerson(tx, {
        name: "جو",
        phone: "03111012",
      });
      const bookingId = await insertApprovedOwnerBooking(tx, {
        pitchId: fixture.pitchId,
        start: slot.startAt,
        end: slot.endAt,
        priceUsd: new Decimal("30.00"),
      });
      await insertRequesterParticipant(tx, {
        bookingId,
        personId: person.id,
        amountDueUsd: new Decimal("30.00"),
      });
      return { bookingId, personId: person.id };
    });

    await recordNoShow({ bookingId: seeded.bookingId });
    const afterNoShow = await getPersonBookingStats(seeded.personId);
    expect(afterNoShow.owesNowUsd.equals("30.00")).toBe(true);

    await adjustBookingDue({
      bookingId: seeded.bookingId,
      toUsd: new Decimal(0),
      reason: "WAIVER",
      note: null,
    });

    const afterWaiver = await getPersonBookingStats(seeded.personId);
    expect(afterWaiver.owesNowUsd.equals(0)).toBe(true);
    const ledger = await platformDb.ledgerEntry.count({
      where: { sourceId: seeded.bookingId },
    });
    expect(ledger).toBe(0);
    const booking = await platformDb.booking.findUniqueOrThrow({
      where: { id: seeded.bookingId },
    });
    expect(booking.status).toBe("NO_SHOW");
    expect(money(booking.amountDueUsd).equals(0)).toBe(true);

    await assertMoneyInvariants([seeded.personId]);
  });

  it("refuses a due below what was collected and writes nothing", async () => {
    const slot = await eveningSlot(fixture.pitchId, 3);
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "Maya",
      phone: "03111013",
    });
    const person = await personByPhone(fixture.tenantId, "03111013");
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("10.00") }],
    });
    const before = await platformDb.bookingDueChange.count({ where: { bookingId } });
    const beforeDue = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { amountDueUsd: true },
    });

    await expect(
      adjustBookingDue({
        bookingId,
        toUsd: new Decimal("5.00"),
        reason: "CORRECTION",
        note: null,
      }),
    ).rejects.toMatchObject({ key: "booking.due_below_collected" });

    const after = await platformDb.bookingDueChange.count({ where: { bookingId } });
    const afterDue = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { amountDueUsd: true },
    });
    expect(after).toBe(before);
    expect(money(afterDue.amountDueUsd).equals(money(beforeDue.amountDueUsd))).toBe(true);

    await assertMoneyInvariants([person.id]);
  });

  it("hides tenant A from tenant B use cases", async () => {
    const slot = await eveningSlot(fixture.pitchId, 3);
    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "أحمد",
      phone: "03111014",
    });
    const personA = await personByPhone(fixture.tenantId, "03111014");
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("10.00") }],
    });
    await assertMoneyInvariants([personA.id]);

    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other Stadium",
      pitchName: "Pitch Other",
      ownerIdentifier: "owner@other-stadium",
    });
    setTenantSlug(other.tenantSlug);
    setSessionCookie(other.sessionId);
    clearReactCache();

    expect(await getPerson(personA.id)).toBeNull();
    const day = await loadOwnerDay(formatCivilDate(slot.day));
    expect(day.games.some((game) => game.id === bookingId)).toBe(false);
    const hiddenStats = await getPersonBookingStats(personA.id);
    expect(hiddenStats.owesNowUsd.equals(0)).toBe(true);
    expect(hiddenStats.expectedUsd.equals(0)).toBe(true);
    await expect(
      collectBookingPayment({
        bookingId,
        tenders: [{ currency: "USD", amount: new Decimal("1.00") }],
      }),
    ).rejects.toMatchObject({ key: "booking.not_found" });

    const otherSlot = await eveningSlot(other.pitchId, 3, 1);
    const { bookingId: bookingB } = await createOwnerBooking({
      pitchId: other.pitchId,
      start: otherSlot.start,
      end: otherSlot.end,
      name: "سامي",
      phone: "03111015",
    });
    const personB = await personByPhone(other.tenantId, "03111015");
    const dayB = await loadOwnerDay(formatCivilDate(otherSlot.day));
    expect(dayB.games.some((game) => game.id === bookingB)).toBe(true);
    expect(dayB.games.some((game) => game.id === bookingId)).toBe(false);

    const stillThere = await platformDb.booking.findUnique({ where: { id: bookingId } });
    expect(stillThere?.tenantId).toBe(fixture.tenantId);
    await assertMoneyInvariants([personB.id]);
  });

  it("counts a game that crosses midnight on its start day", async () => {
    const config = overnightSchedule();
    await platformDb.pitch.update({
      where: { id: fixture.pitchId },
      data: { scheduleConfig: config },
    });
    const today = civilDateInTimeZone(new Date(), TIME_ZONE);
    const day = addCalendarDays(today, 3);
    const slots = generateSlotsForDay({
      config,
      localDate: day,
      timeZone: TIME_ZONE,
      occupied: [],
    });
    expect(slots).toHaveLength(1);
    const slot = slots[0];
    if (!slot) throw new Error("overnight slot missing");

    const { bookingId } = await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      name: "منى",
      phone: "03111016",
    });
    const person = await personByPhone(fixture.tenantId, "03111016");

    const startDay = await loadOwnerDay(formatCivilDate(day));
    expect(startDay.summary.games).toBe(1);
    expect(startDay.games.some((game) => game.id === bookingId)).toBe(true);

    const nextDay = await loadOwnerDay(formatCivilDate(addCalendarDays(day, 1)));
    expect(nextDay.summary.games).toBe(0);
    expect(nextDay.games.some((game) => game.id === bookingId)).toBe(false);

    await assertMoneyInvariants([person.id]);
  });
});

function money(value: { toString(): string } | null | undefined): Decimal {
  return new Decimal(value?.toString() ?? "NaN");
}

async function personByPhone(tenantId: string, phone: string) {
  return platformDb.person.findFirstOrThrow({ where: { tenantId, phone } });
}

async function collectedUsd(bookingId: string): Promise<Decimal> {
  const [row] = await platformDb.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(t."usdEquivalent"), 0)::text AS sum
    FROM "PaymentTender" t
    JOIN "Payment" p ON p.id = t."paymentId"
    WHERE p."sourceId" = ${bookingId}
      AND p."sourceType" = 'BOOKING'::"PaymentSourceType"
  `;
  return new Decimal(row?.sum ?? "0");
}

async function eveningSlot(pitchId: string, daysAhead: number, index = 0) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: pitchId } });
  const config = parseScheduleConfig(pitch.scheduleConfig);
  const today = civilDateInTimeZone(new Date(), TIME_ZONE);
  const day = addCalendarDays(today, daysAhead);
  const slots = generateSlotsForDay({
    config,
    localDate: day,
    timeZone: TIME_ZONE,
    occupied: [],
  });
  const slot = slots[index];
  if (!slot) throw new Error(`no slot ${index} on day offset ${daysAhead}`);
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    startAt: slot.start,
    endAt: slot.end,
    day,
  };
}

async function setLateCancelFee(tenantId: string) {
  await platformDb.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        cancellationWindowHours: 1440,
        lateCancellationFeePercent: 50,
        noShowFeePercent: 100,
      },
    },
  });
  clearReactCache();
}

function overnightSchedule(): ScheduleConfig {
  const hours = { ...CLOSED_WEEK_SCHEDULE.hours } as ScheduleConfig["hours"];
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as Weekday[]) {
    hours[day] = [{ start: "23:00", end: "00:30" }];
  }
  return parseScheduleConfig({
    slotDurationMinutes: 90,
    gapMinutes: 0,
    hours,
    defaultPriceUsd: "30.00",
    priceRules: [],
  });
}
