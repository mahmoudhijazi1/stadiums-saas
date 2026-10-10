import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
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
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Every guarded booking/payment use case, run as STAFF: allowed only when the flag is
 * set (DR-003 §5, SPEC-16 §6). A refused call must write nothing.
 * Tenant policy: 1440h window, 50% late fee, 100% no-show, so every future booking
 * here is a late cancellation with a $15 player fee.
 */
const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;
let phoneSeq = 0;

type Flags = Record<string, true>;

describe("staff permissions on booking and payment use cases", () => {
  beforeEach(async () => {
    await truncateAll();
    fixture = await seedMinimalFixture();
    await setLateFeePercent(50);
    asOwner();
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("approve needs bookings.approve", async () => {
    const pending = await publicRequest(2, 0);
    await asStaff({});
    await expect(approveBooking(pending)).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await statusOf(pending)).toBe("PENDING");
    await asStaff({ "bookings.approve": true });
    await approveBooking(pending);
    expect(await statusOf(pending)).toBe("APPROVED");
  });

  it("owner-create needs bookings.create", async () => {
    const slot = await slotOn(2, 1);
    const input = {
      pitchId: fixture.pitchId,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      name: "هاتف",
      phone: nextPhone(),
    };
    await asStaff({});
    await expect(createOwnerBooking(input)).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await platformDb.booking.count()).toBe(0);
    await asStaff({ "bookings.create": true });
    await createOwnerBooking(input);
    expect(await platformDb.booking.count()).toBe(1);
  });

  it("cancel with the suggested fee needs bookings.cancel", async () => {
    const bookingId = await futureBooking(3, 0);
    await asStaff({});
    await expect(cancelBooking({ bookingId, initiator: "PLAYER" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    expect(await statusOf(bookingId)).toBe("APPROVED");
    await asStaff({ "bookings.cancel": true });
    await cancelBooking({ bookingId, initiator: "PLAYER" });
    expect(await dueOf(bookingId)).toBe("15.00");
  });

  it("cancel with an edited fee needs bookings.adjust_due too", async () => {
    const bookingId = await futureBooking(3, 1);
    await asStaff({ "bookings.cancel": true });
    await expect(
      cancelBooking({ bookingId, initiator: "PLAYER", feeUsd: new Decimal("10.00") }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await statusOf(bookingId)).toBe("APPROVED");
    await asStaff({ "bookings.cancel": true, "bookings.adjust_due": true });
    await cancelBooking({ bookingId, initiator: "PLAYER", feeUsd: new Decimal("10.00") });
    expect(await dueOf(bookingId)).toBe("10.00");
  });

  it("cancel with a waived fee needs bookings.adjust_due too", async () => {
    const bookingId = await futureBooking(3, 2);
    await asStaff({ "bookings.cancel": true });
    await expect(
      cancelBooking({ bookingId, initiator: "PLAYER", feeUsd: new Decimal("0.00") }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await statusOf(bookingId)).toBe("APPROVED");
    await asStaff({ "bookings.cancel": true, "bookings.adjust_due": true });
    await cancelBooking({ bookingId, initiator: "PLAYER", feeUsd: new Decimal("0.00") });
    expect(await dueOf(bookingId)).toBe("0.00");
  });

  it("'I cancelled' that drops a late fee needs bookings.adjust_due (audit §1.5)", async () => {
    const bookingId = await futureBooking(3, 3);
    await asStaff({ "bookings.cancel": true });
    await expect(cancelBooking({ bookingId, initiator: "OWNER" })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    expect(await statusOf(bookingId)).toBe("APPROVED");
    expect(await dueOf(bookingId)).toBe("30.00");
    expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(0);
    await asStaff({ "bookings.cancel": true, "bookings.adjust_due": true });
    await cancelBooking({ bookingId, initiator: "OWNER" });
    expect(await dueOf(bookingId)).toBe("0.00");
  });

  it("'I cancelled' stays open to bookings.cancel when it does not lower the fee", async () => {
    // $15 already collected: the owner path clamps to $15, the player fee is $15.
    const paid = await futureBooking(3, 5);
    await collectBookingPayment({ bookingId: paid, tenders: usd("15.00") });
    await asStaff({ "bookings.cancel": true });
    await cancelBooking({ bookingId: paid, initiator: "OWNER" });
    expect(await statusOf(paid)).toBe("CANCELLED");
    expect(await dueOf(paid)).toBe("15.00");

    // No late fee on this tenant: the player path charges nothing either.
    const noFee = await futureBooking(3, 4);
    await setLateFeePercent(0);
    await asStaff({ "bookings.cancel": true });
    await cancelBooking({ bookingId: noFee, initiator: "OWNER" });
    expect(await statusOf(noFee)).toBe("CANCELLED");
  });

  it("no-show with the suggested fee needs bookings.no_show", async () => {
    const bookingId = await pastBooking(2, 0);
    await asStaff({});
    await expect(recordNoShow({ bookingId })).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await statusOf(bookingId)).toBe("APPROVED");
    await asStaff({ "bookings.no_show": true });
    await recordNoShow({ bookingId });
    expect(await statusOf(bookingId)).toBe("NO_SHOW");
    expect(await dueOf(bookingId)).toBe("30.00");
  });

  it("no-show with an edited fee needs bookings.adjust_due too", async () => {
    const bookingId = await pastBooking(2, 1);
    await asStaff({ "bookings.no_show": true });
    await expect(
      recordNoShow({ bookingId, feeUsd: new Decimal("10.00") }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await statusOf(bookingId)).toBe("APPROVED");
    await asStaff({ "bookings.no_show": true, "bookings.adjust_due": true });
    await recordNoShow({ bookingId, feeUsd: new Decimal("10.00") });
    expect(await dueOf(bookingId)).toBe("10.00");
  });

  it("adjust needs bookings.adjust_due", async () => {
    const bookingId = await futureBooking(4, 0);
    const input = { bookingId, toUsd: new Decimal("20.00"), reason: "DISCOUNT" as const, note: null };
    await asStaff({ "bookings.cancel": true, "payments.collect": true });
    await expect(adjustBookingDue(input)).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await dueOf(bookingId)).toBe("30.00");
    await asStaff({ "bookings.adjust_due": true });
    await adjustBookingDue(input);
    expect(await dueOf(bookingId)).toBe("20.00");
  });

  it("split needs bookings.adjust_due", async () => {
    const bookingId = await futureBooking(4, 1);
    await asStaff({ "payments.collect": true });
    await expect(switchToPerPlayer({ bookingId, count: 5 })).rejects.toMatchObject({
      key: "access.not_allowed",
    });
    expect(await modeOf(bookingId)).toBe("WHOLE");
    await asStaff({ "bookings.adjust_due": true });
    await switchToPerPlayer({ bookingId, count: 5 });
    expect(await modeOf(bookingId)).toBe("PER_PLAYER");
  });

  it("whole-game collect needs payments.collect", async () => {
    const bookingId = await futureBooking(4, 2);
    await asStaff({ "bookings.adjust_due": true });
    await expect(
      collectBookingPayment({ bookingId, tenders: usd("30.00") }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await platformDb.payment.count()).toBe(0);
    await asStaff({ "payments.collect": true });
    await collectBookingPayment({ bookingId, tenders: usd("30.00") });
    expect(await platformDb.payment.count()).toBe(1);
  });

  it("slot pay needs payments.collect", async () => {
    const bookingId = await futureBooking(4, 3);
    await switchToPerPlayer({ bookingId, count: 5 });
    const slot = await platformDb.bookingParticipant.findFirstOrThrow({
      where: { bookingId, slotNumber: 2 },
    });
    await asStaff({ "bookings.adjust_due": true });
    await expect(
      collectSlotPayment({ bookingId, participantId: slot.id }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
    expect(await platformDb.paymentAllocation.count()).toBe(0);
    await asStaff({ "payments.collect": true });
    await collectSlotPayment({ bookingId, participantId: slot.id });
    expect(await platformDb.paymentAllocation.count()).toBe(1);
  });
});

function asOwner() {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
}

/** A fresh STAFF user with exactly these flags, logged in on the fixture tenant. */
async function asStaff(flags: Flags): Promise<void> {
  const sessionId = await createStaffSession(fixture.tenantId, flags);
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(sessionId);
}

async function setLateFeePercent(percent: number): Promise<void> {
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: {
      settings: {
        cancellationWindowHours: 1440,
        lateCancellationFeePercent: percent,
        noShowFeePercent: 100,
        perPlayerSplitEnabled: true,
      },
    },
  });
}

function usd(amount: string) {
  return [{ currency: "USD" as const, amount: new Decimal(amount) }];
}

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(600000 + phoneSeq)}`;
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

/** Created as the owner, then the caller switches identity. */
async function futureBooking(daysAhead: number, index: number): Promise<string> {
  asOwner();
  const slot = await slotOn(daysAhead, index);
  const { bookingId } = await createOwnerBooking({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name: "لاعب",
    phone: nextPhone(),
  });
  return bookingId;
}

async function publicRequest(daysAhead: number, index: number): Promise<string> {
  const slot = await slotOn(daysAhead, index);
  const { bookingId } = await requestPublicSlot({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name: "طالب",
    phone: nextPhone(),
  });
  return bookingId;
}

async function pastBooking(daysAgo: number, index: number): Promise<string> {
  asOwner();
  const slot = await slotOn(-daysAgo, index);
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "جو", phone: nextPhone() });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
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

async function statusOf(bookingId: string) {
  return (await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;
}

async function modeOf(bookingId: string) {
  return (await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } }))
    .collectionMode;
}

async function dueOf(bookingId: string) {
  const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return new Decimal(booking.amountDueUsd.toString()).toFixed(2);
}
