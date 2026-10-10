import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import {
  collectAllRemaining,
  collectSlotPayment,
} from "@/modules/booking/application/collect-player-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
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
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;

describe("per-player collection (SPEC-15 slice 2)", () => {
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

  it("splits into slots without touching the due or logging a change", async () => {
    const bookingId = await ownerBooking("03222001", 3);

    await switchToPerPlayer({ bookingId, count: 7 });

    const booking = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(booking.collectionMode).toBe("PER_PLAYER");
    expect(money(booking.amountDueUsd).equals("30.00")).toBe(true);
    const slots = await slotsOf(bookingId);
    expect(slots).toHaveLength(7);
    expect(slots.map((slot) => slot.slotNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(slots[0]?.isRequester).toBe(true);
    expect(slots[0]?.personId).not.toBeNull();
    expect(slots.slice(1).every((slot) => slot.personId === null)).toBe(true);
    const dues = slots.map((slot) => money(slot.amountDueUsd));
    expect(sum(dues).equals("30.00")).toBe(true);
    expect(dues.filter((due) => due.equals("4.29"))).toHaveLength(4);
    expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(0);
    await assertMoneyInvariants([]);
  });

  it("one tap writes one payment, one USD tender, one ledger IN and one allocation", async () => {
    const bookingId = await ownerBooking("03222002", 3);
    await switchToPerPlayer({ bookingId, count: 10 });
    const [, second] = await slotsOf(bookingId);

    await collectSlotPayment({ bookingId, participantId: second!.id });

    const payments = await platformDb.payment.findMany({
      where: { sourceId: bookingId, sourceType: "BOOKING" },
      include: { tenders: true, allocations: true },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0]?.tenders).toHaveLength(1);
    expect(payments[0]?.tenders[0]?.currency).toBe("USD");
    expect(money(payments[0]?.tenders[0]?.usdEquivalent).equals("3.00")).toBe(true);
    expect(payments[0]?.allocations).toHaveLength(1);
    expect(payments[0]?.allocations[0]?.participantId).toBe(second!.id);
    expect(money(payments[0]?.allocations[0]?.amountUsd).equals("3.00")).toBe(true);
    const ledger = await platformDb.ledgerEntry.findMany({
      where: { sourceId: bookingId },
    });
    expect(ledger).toHaveLength(1);
    expect(money(ledger[0]?.amountUsd).equals("3.00")).toBe(true);
    await assertMoneyInvariants([]);
  });

  it("pays a slot once when the same slot is tapped twice at the same time", async () => {
    const bookingId = await ownerBooking("03222003", 3);
    await switchToPerPlayer({ bookingId, count: 10 });
    const [, second] = await slotsOf(bookingId);

    const results = await Promise.allSettled([
      collectSlotPayment({ bookingId, participantId: second!.id }),
      collectSlotPayment({ bookingId, participantId: second!.id }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      key: "payment.nothing_due",
    });
    expect(
      await platformDb.payment.count({ where: { sourceId: bookingId } }),
    ).toBe(1);
    expect(
      await platformDb.paymentAllocation.count({
        where: { participantId: second!.id },
      }),
    ).toBe(1);
    await assertMoneyInvariants([]);
  });

  it("booker pays all remaining as one payment across the unpaid slots", async () => {
    const bookingId = await ownerBooking("03222004", 3);
    await switchToPerPlayer({ bookingId, count: 10 });
    const slots = await slotsOf(bookingId);
    await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
    await collectSlotPayment({ bookingId, participantId: slots[2]!.id });

    await collectAllRemaining({ bookingId });

    const payments = await platformDb.payment.findMany({
      where: { sourceId: bookingId },
      include: { tenders: true, allocations: true },
    });
    expect(payments).toHaveLength(3);
    const last = payments.find((payment) => payment.allocations.length === 8);
    expect(last).toBeDefined();
    expect(money(last?.tenders[0]?.usdEquivalent).equals("24.00")).toBe(true);
    expect((await allocatedUsd(bookingId)).equals("30.00")).toBe(true);
    expect((await collectedUsd(bookingId)).equals("30.00")).toBe(true);
    await expect(collectAllRemaining({ bookingId })).rejects.toMatchObject({
      key: "payment.nothing_due",
    });
    await assertMoneyInvariants([]);
  });

  it("leaves earlier whole-game payments Unassigned and never charges a slot twice for them", async () => {
    const bookingId = await ownerBooking("03222005", 3);
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("30.00") }],
    });
    // Fully paid games do not offer the switch in the UI, but the use case allows it.
    await switchToPerPlayer({ bookingId, count: 10 });
    expect((await allocatedUsd(bookingId)).equals(0)).toBe(true);

    // Unassigned $30 already covers the booking: a slot tap and pay-all take nothing
    // (audit §3.6; supersedes "a slot checks only its own remaining").
    const [, second] = await slotsOf(bookingId);
    await expect(
      collectSlotPayment({ bookingId, participantId: second!.id }),
    ).rejects.toMatchObject({ key: "payment.nothing_due" });
    await expect(collectAllRemaining({ bookingId })).rejects.toMatchObject({
      key: "payment.nothing_due",
    });

    expect((await collectedUsd(bookingId)).equals("30.00")).toBe(true);
    expect((await allocatedUsd(bookingId)).equals(0)).toBe(true);
    const day = await ownerDayFor(bookingId);
    expect(day?.unassignedUsd.equals("30.00")).toBe(true);
    expect(day?.remaining.equals("0.00")).toBe(true);
    await assertMoneyInvariants([]);
  });

  it("audit probe: $10 before the split and 2 slots paid, pay-all takes exactly the $14 owed", async () => {
    const bookingId = await ownerBooking("03222021", 3);
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("10.00") }],
    });
    await switchToPerPlayer({ bookingId, count: 10 });
    const slots = await slotsOf(bookingId);
    await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
    await collectSlotPayment({ bookingId, participantId: slots[2]!.id });

    await collectAllRemaining({ bookingId });

    const payments = await platformDb.payment.findMany({
      where: { sourceId: bookingId },
      include: { tenders: true, allocations: true },
      orderBy: { createdAt: "asc" },
    });
    const last = payments.find((payment) => payment.allocations.length > 1)!;
    expect(money(last.tenders[0]?.usdEquivalent).equals("14.00")).toBe(true);
    // Slots 1, 4, 5, 6 in full, slot 7 partial; 8–10 stay unpaid, covered by Unassigned.
    const bySlot = new Map(slots.map((slot) => [slot.id, slot.slotNumber]));
    expect(
      last.allocations
        .map((row) => [bySlot.get(row.participantId), money(row.amountUsd).toFixed(2)])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual([
      [1, "3.00"],
      [4, "3.00"],
      [5, "3.00"],
      [6, "3.00"],
      [7, "2.00"],
    ]);
    expect((await collectedUsd(bookingId)).equals("30.00")).toBe(true);
    expect((await allocatedUsd(bookingId)).equals("20.00")).toBe(true);
    const day = await ownerDayFor(bookingId);
    expect(day?.remaining.equals("0.00")).toBe(true);
    expect(day?.unassignedUsd.equals("10.00")).toBe(true);

    // Nothing is owed any more: every remaining tap is refused.
    await expect(
      collectSlotPayment({ bookingId, participantId: slots[7]!.id }),
    ).rejects.toMatchObject({ key: "payment.nothing_due" });
    await expect(collectAllRemaining({ bookingId })).rejects.toMatchObject({
      key: "payment.nothing_due",
    });
    await assertMoneyInvariants([]);
  });

  it("charges a single slot only what the booking still owes (partial tap)", async () => {
    const bookingId = await ownerBooking("03222022", 3);
    await collectBookingPayment({
      bookingId,
      tenders: [{ currency: "USD", amount: new Decimal("28.50") }],
    });
    await switchToPerPlayer({ bookingId, count: 10 });
    const [first] = await slotsOf(bookingId);

    await collectSlotPayment({ bookingId, participantId: first!.id });

    expect((await collectedUsd(bookingId)).equals("30.00")).toBe(true);
    expect((await allocatedUsd(bookingId)).equals("1.50")).toBe(true);
    await assertMoneyInvariants([]);
  });

  it("refuses the whole-game collect on a per-player booking", async () => {
    const bookingId = await ownerBooking("03222006", 3);
    await switchToPerPlayer({ bookingId, count: 10 });

    await expect(
      collectBookingPayment({
        bookingId,
        tenders: [{ currency: "USD", amount: new Decimal("30.00") }],
      }),
    ).rejects.toMatchObject({ key: "booking.collect_per_player" });
    expect(await platformDb.payment.count({ where: { sourceId: bookingId } })).toBe(0);
  });

  it("goes back to whole only while no allocation exists", async () => {
    const bookingId = await ownerBooking("03222007", 3);
    await switchToPerPlayer({ bookingId, count: 10 });

    await switchToWhole({ bookingId });

    const booking = await platformDb.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(booking.collectionMode).toBe("WHOLE");
    const participants = await platformDb.bookingParticipant.findMany({
      where: { bookingId },
    });
    expect(participants).toHaveLength(1);
    expect(participants[0]?.isRequester).toBe(true);
    expect(participants[0]?.slotNumber).toBeNull();
    expect(money(participants[0]?.amountDueUsd).equals("30.00")).toBe(true);

    await switchToPerPlayer({ bookingId, count: 5 });
    const [, second] = await slotsOf(bookingId);
    await collectSlotPayment({ bookingId, participantId: second!.id });
    await expect(switchToWhole({ bookingId })).rejects.toMatchObject({
      key: "booking.switch_has_allocations",
    });
    expect((await slotsOf(bookingId))).toHaveLength(5);
    await assertMoneyInvariants([]);
  });

  it("refuses to split cancelled, no-show, pending, zero-due, bad-count and already split bookings", async () => {
    // CANCELLED
    const cancelledId = await ownerBooking("03222008", 3);
    await platformDb.$executeRaw`
      UPDATE "Booking" SET status = 'CANCELLED'::"BookingStatus" WHERE id = ${cancelledId}
    `;
    await expect(switchToPerPlayer({ bookingId: cancelledId, count: 10 })).rejects.toMatchObject({
      key: "booking.switch_fee_booking",
    });

    // NO_SHOW
    const noShowId = await ownerBooking("03222009", 4);
    await platformDb.$executeRaw`
      UPDATE "Booking" SET status = 'NO_SHOW'::"BookingStatus" WHERE id = ${noShowId}
    `;
    await expect(switchToPerPlayer({ bookingId: noShowId, count: 10 })).rejects.toMatchObject({
      key: "booking.switch_fee_booking",
    });

    // PENDING
    const slot = await eveningSlot(fixture.pitchId, 5);
    const pendingId = await requestPublicSlot({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "سعيد",
      phone: "03222010",
    }).then((result) => result.bookingId);
    await expect(switchToPerPlayer({ bookingId: pendingId, count: 10 })).rejects.toMatchObject({
      key: "booking.switch_not_approved",
    });

    // zero due
    const freeId = await ownerBooking("03222011", 6);
    await adjustBookingDue({
      bookingId: freeId,
      toUsd: new Decimal(0),
      reason: "WAIVER",
      note: null,
    });
    await expect(switchToPerPlayer({ bookingId: freeId, count: 10 })).rejects.toMatchObject({
      key: "booking.switch_no_due",
    });

    // bad counts and double switch
    const okId = await ownerBooking("03222012", 7);
    for (const count of [0, 31]) {
      await expect(switchToPerPlayer({ bookingId: okId, count })).rejects.toMatchObject({
        key: "booking.split_count",
      });
    }
    expect((await platformDb.booking.findUniqueOrThrow({ where: { id: okId } })).collectionMode).toBe(
      "WHOLE",
    );
    await switchToPerPlayer({ bookingId: okId, count: 30 });
    expect(await slotsOf(okId)).toHaveLength(30);
    await expect(switchToPerPlayer({ bookingId: okId, count: 10 })).rejects.toMatchObject({
      key: "booking.switch_not_whole",
    });
  });

  it("rolls the whole switch back when a slot insert fails", async () => {
    const bookingId = await ownerBooking("03222013", 3);
    // Occupy slot number 2 so the insert of slot 2 hits the partial unique index.
    await platformDb.bookingParticipant.create({
      data: {
        tenantId: fixture.tenantId,
        bookingId,
        personId: null,
        amountDueUsd: "0.00",
        slotNumber: 2,
        isRequester: false,
      },
    });

    await expect(switchToPerPlayer({ bookingId, count: 10 })).rejects.toBeDefined();

    const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.collectionMode).toBe("WHOLE");
    const requester = await platformDb.bookingParticipant.findFirstOrThrow({
      where: { bookingId, isRequester: true },
    });
    expect(requester.slotNumber).toBeNull();
    expect(money(requester.amountDueUsd).equals("30.00")).toBe(true);
    expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(2);
  });

  it("scopes PaymentAllocation to the current stadium", async () => {
    const bookingId = await ownerBooking("03222016", 3);
    await switchToPerPlayer({ bookingId, count: 10 });
    const [, second] = await slotsOf(bookingId);
    await collectSlotPayment({ bookingId, participantId: second!.id });
    expect(await db.paymentAllocation.count()).toBe(1);

    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other Stadium",
      pitchName: "Pitch O1",
      ownerIdentifier: "owner@other-stadium",
    });
    setTenantSlug(other.tenantSlug);
    setSessionCookie(other.sessionId);
    clearReactCache();

    expect(await db.paymentAllocation.count()).toBe(0);
    const stamped = await platformDb.paymentAllocation.findFirstOrThrow();
    expect(stamped.tenantId).toBe(fixture.tenantId);
  });

  describe("cancel and no-show on a per-player booking", () => {
  async function pastBooking(phone: string): Promise<string> {
    const slot = await eveningSlot(fixture.pitchId, -2);
    return db.$transaction(async (tx) => {
      const person = await findOrCreatePerson(tx, { name: "جو", phone });
      const id = await insertApprovedOwnerBooking(tx, {
        pitchId: fixture.pitchId,
        start: slot.startAt,
        end: slot.endAt,
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

    it("cancel collapses a per-player booking with payments to WHOLE in one transaction", async () => {
      const bookingId = await ownerBooking("03222014", 3);
      await collectBookingPayment({
        bookingId,
        tenders: [{ currency: "USD", amount: new Decimal("10.00") }],
      });
      await switchToPerPlayer({ bookingId, count: 10 });
      const slots = await slotsOf(bookingId);
      await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
      await collectSlotPayment({ bookingId, participantId: slots[2]!.id });
      const paymentsBefore = await platformDb.payment.count({ where: { sourceId: bookingId } });
      const ledgerBefore = await platformDb.ledgerEntry.count({ where: { sourceId: bookingId } });
      expect((await allocatedUsd(bookingId)).equals("6.00")).toBe(true);

      await cancelBooking({ bookingId, initiator: "OWNER" });

      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const collected = await collectedUsd(bookingId);
      expect(booking.status).toBe("CANCELLED");
      expect(booking.collectionMode).toBe("WHOLE");
      expect(collected.equals("16.00")).toBe(true);
      expect(money(booking.amountDueUsd).equals(collected)).toBe(true);
      const participants = await platformDb.bookingParticipant.findMany({ where: { bookingId } });
      expect(participants).toHaveLength(1);
      expect(participants[0]?.isRequester).toBe(true);
      expect(participants[0]?.slotNumber).toBeNull();
      expect((await allocatedUsd(bookingId)).equals(0)).toBe(true);
      expect(await platformDb.payment.count({ where: { sourceId: bookingId } })).toBe(paymentsBefore);
      expect(await platformDb.ledgerEntry.count({ where: { sourceId: bookingId } })).toBe(ledgerBefore);
      expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(1);
      await assertMoneyInvariants([]);
    });

    it("cancel with an edited fee applies the usual due change after collapsing", async () => {
      const bookingId = await ownerBooking("03222017", 3);
      await switchToPerPlayer({ bookingId, count: 10 });
      const slots = await slotsOf(bookingId);
      await collectSlotPayment({ bookingId, participantId: slots[1]!.id });

      await cancelBooking({ bookingId, initiator: "OWNER", feeUsd: new Decimal("20.00") });

      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("CANCELLED");
      expect(booking.collectionMode).toBe("WHOLE");
      expect(money(booking.amountDueUsd).equals("20.00")).toBe(true);
      const change = await platformDb.bookingDueChange.findFirstOrThrow({ where: { bookingId } });
      expect(money(change.fromUsd).equals("30.00")).toBe(true);
      expect(money(change.toUsd).equals("20.00")).toBe(true);
      await assertMoneyInvariants([]);
    });

    it("cancel with nothing paid also collapses", async () => {
      const bookingId = await ownerBooking("03222018", 3);
      await switchToPerPlayer({ bookingId, count: 10 });

      await cancelBooking({ bookingId, initiator: "OWNER" });

      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("CANCELLED");
      expect(booking.collectionMode).toBe("WHOLE");
      expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(1);
    });

    it("no-show at the default fee collapses to WHOLE and keeps every payment", async () => {
      const bookingId = await pastBooking("03222015");
      await switchToPerPlayer({ bookingId, count: 10 });
      const slots = await slotsOf(bookingId);
      await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
      const paymentsBefore = await platformDb.payment.count({ where: { sourceId: bookingId } });
      const ledgerBefore = await platformDb.ledgerEntry.count({ where: { sourceId: bookingId } });

      await recordNoShow({ bookingId });

      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("NO_SHOW");
      expect(booking.collectionMode).toBe("WHOLE");
      expect(money(booking.amountDueUsd).equals("30.00")).toBe(true);
      expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(1);
      expect((await allocatedUsd(bookingId)).equals(0)).toBe(true);
      expect(await platformDb.payment.count({ where: { sourceId: bookingId } })).toBe(paymentsBefore);
      expect(await platformDb.ledgerEntry.count({ where: { sourceId: bookingId } })).toBe(ledgerBefore);
      // The fee is now collectable as a whole-game payment.
      await collectBookingPayment({
        bookingId,
        tenders: [{ currency: "USD", amount: new Decimal("27.00") }],
      });
      expect((await collectedUsd(bookingId)).equals("30.00")).toBe(true);
      await assertMoneyInvariants([]);
    });

    it("no-show with an edited fee collapses, then applies the usual due change", async () => {
      const bookingId = await pastBooking("03222019");
      await switchToPerPlayer({ bookingId, count: 10 });
      const slots = await slotsOf(bookingId);
      await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
      await collectSlotPayment({ bookingId, participantId: slots[2]!.id });

      await recordNoShow({ bookingId, feeUsd: new Decimal("20.00") });

      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("NO_SHOW");
      expect(booking.collectionMode).toBe("WHOLE");
      expect(money(booking.amountDueUsd).equals("20.00")).toBe(true);
      expect((await collectedUsd(bookingId)).equals("6.00")).toBe(true);
      expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(1);
      expect((await allocatedUsd(bookingId)).equals(0)).toBe(true);
      const change = await platformDb.bookingDueChange.findFirstOrThrow({ where: { bookingId } });
      expect(money(change.fromUsd).equals("30.00")).toBe(true);
      expect(money(change.toUsd).equals("20.00")).toBe(true);
      await assertMoneyInvariants([]);
    });

    it("no-show waived to 0 keeps what was collected as the due (existing clamp) and collapses", async () => {
      const bookingId = await pastBooking("03222020");
      await switchToPerPlayer({ bookingId, count: 10 });
      const slots = await slotsOf(bookingId);
      await collectSlotPayment({ bookingId, participantId: slots[1]!.id });

      await recordNoShow({ bookingId, feeUsd: new Decimal("0.00") });

      const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("NO_SHOW");
      expect(booking.collectionMode).toBe("WHOLE");
      expect(money(booking.amountDueUsd).equals("3.00")).toBe(true);
      expect((await collectedUsd(bookingId)).equals("3.00")).toBe(true);
      expect(await platformDb.bookingParticipant.count({ where: { bookingId } })).toBe(1);
      expect((await allocatedUsd(bookingId)).equals(0)).toBe(true);
      await assertMoneyInvariants([]);
    });
  });
});

function money(value: { toString(): string } | null | undefined): Decimal {
  return new Decimal(value?.toString() ?? "NaN");
}

function sum(values: Decimal[]): Decimal {
  return values.reduce((total, value) => total.plus(value), new Decimal(0));
}

async function ownerBooking(phone: string, daysAhead: number): Promise<string> {
  const slot = await eveningSlot(fixture.pitchId, daysAhead);
  const { bookingId } = await createOwnerBooking({
    pitchId: fixture.pitchId,
    start: slot.start,
    end: slot.end,
    name: `لاعب ${phone}`,
    phone,
  });
  return bookingId;
}

async function slotsOf(bookingId: string) {
  return platformDb.bookingParticipant.findMany({
    where: { bookingId, slotNumber: { not: null } },
    orderBy: { slotNumber: "asc" },
  });
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

async function allocatedUsd(bookingId: string): Promise<Decimal> {
  const [row] = await platformDb.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(a."amountUsd"), 0)::text AS sum
    FROM "PaymentAllocation" a
    JOIN "BookingParticipant" bp ON bp.id = a."participantId"
    WHERE bp."bookingId" = ${bookingId}
  `;
  return new Decimal(row?.sum ?? "0");
}

async function ownerDayFor(bookingId: string) {
  const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  void booking;
  const [row] = await platformDb.$queryRaw<Array<{ start: Date }>>`
    SELECT lower(during) AS start FROM "Booking" WHERE id = ${bookingId}
  `;
  const civil = civilDateInTimeZone(row!.start, TIME_ZONE);
  const param = `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;
  const day = await loadOwnerDay(param);
  return day.games.find((game) => game.id === bookingId);
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
  };
}
