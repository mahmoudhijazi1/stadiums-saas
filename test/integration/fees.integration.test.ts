import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
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
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Cancel and no-show fees: capped at the current due, and the no-show log reason is a
 * no-show reason (NO_SHOW_FEE or WAIVER), never CANCELLATION_NO_FEE.
 */
const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;
let phoneSeq = 0;

describe("cancel and no-show fees", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    await setNoShowPercent(100);
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("rejects a cancel fee above the due and writes nothing; a fee equal to the due is accepted", async () => {
    const over = await futureBooking(3, 0);
    await expect(
      cancelBooking({ bookingId: over, initiator: "PLAYER", feeUsd: new Decimal("30.01") }),
    ).rejects.toMatchObject({ key: "booking.fee_above_due" });
    expect(await statusOf(over)).toBe("APPROVED");
    expect(await changesOf(over)).toEqual([]);

    const equal = await futureBooking(3, 1);
    await cancelBooking({ bookingId: equal, initiator: "PLAYER", feeUsd: new Decimal("30.00") });
    expect(await statusOf(equal)).toBe("CANCELLED");
    expect(await dueOf(equal)).toBe("30.00");
  });

  it("rejects a no-show fee above the due and writes nothing; a fee equal to the due is accepted", async () => {
    const over = await pastBooking(2, 0);
    await expect(
      recordNoShow({ bookingId: over, feeUsd: new Decimal("45.00") }),
    ).rejects.toMatchObject({ key: "booking.fee_above_due" });
    expect(await statusOf(over)).toBe("APPROVED");
    expect(await changesOf(over)).toEqual([]);

    const equal = await pastBooking(2, 1);
    await recordNoShow({ bookingId: equal, feeUsd: new Decimal("30.00") });
    expect(await statusOf(equal)).toBe("NO_SHOW");
    expect(await dueOf(equal)).toBe("30.00");
  });

  it("default no-show: 100% leaves the due unchanged (no row); 50% logs NO_SHOW_FEE", async () => {
    const full = await pastBooking(3, 0);
    await recordNoShow({ bookingId: full });
    expect(await changesOf(full)).toEqual([]);

    await setNoShowPercent(50);
    const half = await pastBooking(3, 1);
    await recordNoShow({ bookingId: half });
    expect(await changesOf(half)).toEqual([["NO_SHOW_FEE", "30.00", "15.00"]]);

    // Suggestion kept, but $20 collected already covers it: still a no-show fee.
    const covered = await pastBooking(3, 2);
    await collectBookingPayment({ bookingId: covered, tenders: usd("20.00") });
    await recordNoShow({ bookingId: covered });
    expect(await changesOf(covered)).toEqual([["NO_SHOW_FEE", "30.00", "20.00"]]);
    await assertMoneyInvariants([]);
  });

  it("edited no-show: above collected is NO_SHOW_FEE, down to collected is WAIVER", async () => {
    const edited = await pastBooking(4, 0);
    await recordNoShow({ bookingId: edited, feeUsd: new Decimal("10.00") });
    expect(await changesOf(edited)).toEqual([["NO_SHOW_FEE", "30.00", "10.00"]]);

    const editedBelow = await pastBooking(4, 1);
    await collectBookingPayment({ bookingId: editedBelow, tenders: usd("5.00") });
    await recordNoShow({ bookingId: editedBelow, feeUsd: new Decimal("2.00") });
    expect(await changesOf(editedBelow)).toEqual([["WAIVER", "30.00", "5.00"]]);
    await assertMoneyInvariants([]);
  });

  it("waived no-show logs WAIVER, with or without money collected", async () => {
    const nothingPaid = await pastBooking(5, 0);
    await recordNoShow({ bookingId: nothingPaid, feeUsd: new Decimal("0.00") });
    expect(await changesOf(nothingPaid)).toEqual([["WAIVER", "30.00", "0.00"]]);

    const partlyPaid = await pastBooking(5, 1);
    await collectBookingPayment({ bookingId: partlyPaid, tenders: usd("3.00") });
    await recordNoShow({ bookingId: partlyPaid, feeUsd: new Decimal("0.00") });
    expect(await changesOf(partlyPaid)).toEqual([["WAIVER", "30.00", "3.00"]]);
    await assertMoneyInvariants([]);
  });
});

async function setNoShowPercent(percent: number): Promise<void> {
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: {
      settings: {
        cancellationWindowHours: 24,
        lateCancellationFeePercent: 50,
        noShowFeePercent: percent,
      },
    },
  });
}

function usd(amount: string) {
  return [{ currency: "USD" as const, amount: new Decimal(amount) }];
}

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(710000 + phoneSeq)}`;
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

async function futureBooking(daysAhead: number, index: number): Promise<string> {
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

async function pastBooking(daysAgo: number, index: number): Promise<string> {
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

async function dueOf(bookingId: string) {
  const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return new Decimal(booking.amountDueUsd.toString()).toFixed(2);
}

/** [reason, from, to] per due change, oldest first. */
async function changesOf(bookingId: string): Promise<string[][]> {
  const rows = await platformDb.bookingDueChange.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => [
    row.reason,
    new Decimal(row.fromUsd.toString()).toFixed(2),
    new Decimal(row.toUsd.toString()).toFixed(2),
  ]);
}
