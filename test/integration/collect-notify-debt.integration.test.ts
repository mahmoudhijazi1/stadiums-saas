import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { listDebtWarnings } from "@/modules/booking/application/list-debt-warnings";
import { loadOutcomeNotify } from "@/modules/booking/application/load-outcome-notify";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import {
  findBookingFeeState,
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
  listDebtParticipations,
  listEndedWithRemaining,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
  localTimeToUtc,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Audit §6: the To collect SQL, the fee a customer is told after cancel / no-show /
 * adjust, and the debt warning query, on the real database.
 */
const TIME_ZONE = "Asia/Beirut";

let fixture: TestFixture;
let phoneSeq = 0;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  signIn(fixture.tenantSlug, fixture.sessionId);
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: {
      settings: { cancellationWindowHours: 1440, lateCancellationFeePercent: 50, noShowFeePercent: 100 },
    },
  });
});

describe("listEndedWithRemaining (To collect)", () => {
  it("lists every owed game oldest first and leaves out paid, upcoming and other stadiums", async () => {
    const unpaid = (await pastBooking(6, 0)).bookingId;
    const partial = (await pastBooking(5, 0)).bookingId;
    await collectBookingPayment({ bookingId: partial, tenders: usd("10.00") });
    const noShow = (await pastBooking(4, 0)).bookingId;
    await recordNoShow({ bookingId: noShow, feeUsd: new Decimal("20.00") });
    const perPlayer = (await pastBooking(3, 0)).bookingId;
    await switchToPerPlayer({ bookingId: perPlayer, count: 3 });
    const [, second] = await slotsOf(perPlayer);
    await collectSlotPayment({ bookingId: perPlayer, participantId: second!.id });
    const paid = (await pastBooking(2, 0)).bookingId;
    await collectBookingPayment({ bookingId: paid, tenders: usd("30.00") });
    const upcoming = await futureBooking(3, 0);
    const cancelledWithFee = await futureBooking(4, 0);
    await cancelBooking({ bookingId: cancelledWithFee, initiator: "PLAYER" }); // 50% = $15

    const other = await seedMinimalFixture({
      tenantSlug: "other-stadium",
      tenantName: "Other",
      pitchName: "PO",
      ownerIdentifier: "owner@other-stadium",
    });
    signIn(other.tenantSlug, other.sessionId);
    const otherUnpaid = (await pastBooking(6, 1, other.pitchId)).bookingId;
    signIn(fixture.tenantSlug, fixture.sessionId);

    const rows = await listEndedWithRemaining(db, new Date(), 50);
    expect(rows.map((row) => row.id)).toEqual([unpaid, partial, noShow, perPlayer, cancelledWithFee]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(partial)!.collectedUsd.toFixed(2)).toBe("10.00");
    expect(byId.get(noShow)!.amountDueUsd.toFixed(2)).toBe("20.00");
    expect(byId.get(perPlayer)!.collectionMode).toBe("PER_PLAYER");
    expect(byId.get(perPlayer)!.collectedUsd.toFixed(2)).toBe("10.00");
    expect(byId.get(cancelledWithFee)!.amountDueUsd.toFixed(2)).toBe("15.00");
    for (const excluded of [paid, upcoming, otherUnpaid]) expect(byId.has(excluded)).toBe(false);
  });

  it("includes a game that ends after midnight only once it has ended", async () => {
    const day = { year: 2026, month: 9, day: 1 };
    const start = localTimeToUtc(day, 23, 30, TIME_ZONE);
    const end = localTimeToUtc(addCalendarDays(day, 1), 0, 30, TIME_ZONE);
    const { bookingId } = await insertGame(start, end);

    const at0015 = localTimeToUtc(addCalendarDays(day, 1), 0, 15, TIME_ZONE);
    const at0045 = localTimeToUtc(addCalendarDays(day, 1), 0, 45, TIME_ZONE);
    expect((await listEndedWithRemaining(db, at0015, 50)).map((row) => row.id)).not.toContain(
      bookingId,
    );
    expect((await listEndedWithRemaining(db, at0045, 50)).map((row) => row.id)).toContain(
      bookingId,
    );
  });

  it("returns one extra row so the caller can tell there is more", async () => {
    for (let i = 0; i < 3; i += 1) await pastBooking(2 + i, 1);
    expect(await listEndedWithRemaining(db, new Date(), 2)).toHaveLength(2);
  });
});

describe("loadOutcomeNotify / findBookingFeeState", () => {
  it("after a player cancel, the fee in the message is the saved due change", async () => {
    const bookingId = await futureBooking(5, 0);
    await collectBookingPayment({ bookingId, tenders: usd("5.00") });
    await cancelBooking({ bookingId, initiator: "PLAYER" });

    const state = await findBookingFeeState(db, bookingId);
    const change = await latestChange(bookingId);
    expect(state!.dueToUsd!.toFixed(2)).toBe(change.toUsd);
    expect(state!.amountDueUsd.toFixed(2)).toBe("15.00");
    expect(state!.collectedUsd.toFixed(2)).toBe("5.00");
    expect(state!.dueNote).toBe("PLAYER");

    const notify = await loadOutcomeNotify({ bookingId, kind: "cancelled" });
    expect(notify!.message).toContain(`$${Number(change.toUsd)}`); // "$15"
    expect(await loadOutcomeNotify({ bookingId, kind: "no_show" })).toBeNull();
  });

  it("after an owner cancel, the message is the owner template with no fee", async () => {
    const bookingId = await futureBooking(5, 1);
    await cancelBooking({ bookingId, initiator: "OWNER" });
    const notify = await loadOutcomeNotify({ bookingId, kind: "cancelled" });
    expect(notify!.message).not.toContain("$");
    expect((await findBookingFeeState(db, bookingId))!.dueNote).toBe("OWNER");
  });

  it("after an edited no-show, the fee in the message is the saved due", async () => {
    const { bookingId } = await pastBooking(7, 0);
    await recordNoShow({ bookingId, feeUsd: new Decimal("20.00") });
    const change = await latestChange(bookingId);
    expect(change.toUsd).toBe("20.00");
    const notify = await loadOutcomeNotify({ bookingId, kind: "no_show" });
    expect(notify!.message).toContain("$20");
  });

  it("after an adjust, the reminder amount is the saved due minus what was collected", async () => {
    const { bookingId } = await pastBooking(8, 0);
    await collectBookingPayment({ bookingId, tenders: usd("10.00") });
    await adjustBookingDue({ bookingId, toUsd: new Decimal("25.00"), reason: "DISCOUNT", note: null });
    expect((await latestChange(bookingId)).toUsd).toBe("25.00");
    const notify = await loadOutcomeNotify({ bookingId, kind: "due" });
    expect(notify!.message).toContain("$15");
  });
});

describe("listDebtWarnings / listDebtParticipations", () => {
  it("per-player with Unassigned: the requester owes only their own slot; unnamed slots owe no one", async () => {
    const { bookingId, personId } = await pastBooking(9, 0);
    await collectBookingPayment({ bookingId, tenders: usd("10.00") });
    await switchToPerPlayer({ bookingId, count: 10 });
    const slots = await slotsOf(bookingId);
    await collectSlotPayment({ bookingId, participantId: slots[1]!.id });
    await collectSlotPayment({ bookingId, participantId: slots[2]!.id });

    const rows = await listDebtParticipations(db, [personId]);
    expect(rows).toHaveLength(1); // only the requester's slot; unnamed slots have no person
    expect(rows[0]!.isRequester).toBe(true);
    expect(rows[0]!.collectionMode).toBe("PER_PLAYER");
    expect(rows[0]!.participantDueUsd.toFixed(2)).toBe("3.00");
    expect(rows[0]!.allocatedUsd.toFixed(2)).toBe("0.00");
    expect(rows[0]!.collectedUsd.toFixed(2)).toBe("16.00");

    // Booking remaining is $14, but the person owes only slot 1's $3: the $10 paid
    // before the split is Unassigned and counts for no one (audit #6, still open).
    const [warning] = await listDebtWarnings([personId]);
    expect(warning!.totalUsd.toFixed(2)).toBe("3.00");
    const unnamedUnpaid = await platformDb.bookingParticipant.count({
      where: { bookingId, personId: null },
    });
    expect(unnamedUnpaid).toBe(9);
  });

  it("sums a person's owed games with the latest reason and leaves out paid and upcoming ones", async () => {
    const person = await createPerson();
    const older = await pastBooking(12, 0, fixture.pitchId, person);
    await recordNoShow({ bookingId: older.bookingId, feeUsd: new Decimal("20.00") });
    const newer = await pastBooking(10, 0, fixture.pitchId, person);
    const paid = await pastBooking(11, 0, fixture.pitchId, person);
    await collectBookingPayment({ bookingId: paid.bookingId, tenders: usd("30.00") });

    const [warning] = await listDebtWarnings([person.id]);
    expect(warning!.totalUsd.toFixed(2)).toBe("50.00");
    // The note is the owed booking with the latest start; it has no due change.
    expect(warning!.at.getTime()).toBe((await startOf(newer.bookingId)).getTime());
    expect(warning!.reason).toBeNull();
    expect(await listDebtWarnings([])).toEqual([]);
  });
});

function signIn(tenantSlug: string, sessionId: string) {
  clearRequestStubs();
  setTenantSlug(tenantSlug);
  setSessionCookie(sessionId);
}

function usd(amount: string) {
  return [{ currency: "USD" as const, amount: new Decimal(amount) }];
}

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(720000 + phoneSeq)}`;
}

async function createPerson() {
  return db.$transaction((tx) => findOrCreatePerson(tx, { name: "مدين", phone: nextPhone() }));
}

async function slotOn(daysAhead: number, index: number, pitchId = fixture.pitchId) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: pitchId } });
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

async function pastBooking(
  daysAgo: number,
  index: number,
  pitchId = fixture.pitchId,
  person?: { id: string },
): Promise<{ bookingId: string; personId: string }> {
  const slot = await slotOn(-daysAgo, index, pitchId);
  return insertGame(slot.start, slot.end, pitchId, person);
}

async function insertGame(
  start: Date,
  end: Date,
  pitchId = fixture.pitchId,
  person?: { id: string },
): Promise<{ bookingId: string; personId: string }> {
  return db.$transaction(async (tx) => {
    const personId =
      person?.id ?? (await findOrCreatePerson(tx, { name: "جو", phone: nextPhone() })).id;
    const bookingId = await insertApprovedOwnerBooking(tx, {
      pitchId,
      start,
      end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, {
      bookingId,
      personId,
      amountDueUsd: new Decimal("30.00"),
    });
    return { bookingId, personId };
  });
}

async function slotsOf(bookingId: string) {
  return platformDb.bookingParticipant.findMany({
    where: { bookingId, slotNumber: { not: null } },
    orderBy: { slotNumber: "asc" },
  });
}

async function latestChange(bookingId: string) {
  const row = await platformDb.bookingDueChange.findFirstOrThrow({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });
  return { reason: row.reason, toUsd: new Decimal(row.toUsd.toString()).toFixed(2) };
}

async function startOf(bookingId: string): Promise<Date> {
  const [row] = await platformDb.$queryRaw<Array<{ start: Date }>>`
    SELECT lower(during) AS start FROM "Booking" WHERE id = ${bookingId}
  `;
  return row!.start;
}
